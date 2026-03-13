import type { Plugin } from 'vite';
import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { execSync } from 'child_process';

const HOME = process.env.HOME || '/Users/home';
const CLAUDE_DIR = join(HOME, '.claude');
const PROJECTS_DIR = join(CLAUDE_DIR, 'projects');
const OPENCLAW_DIR = join(HOME, '.openclaw');
const BRODIE_SESSIONS_DIR = join(OPENCLAW_DIR, 'agents', 'main', 'sessions');
const CRON_RUNS_DIR = join(OPENCLAW_DIR, 'cron', 'runs');
const CRON_JOBS_FILE = join(OPENCLAW_DIR, 'cron', 'jobs.json');

// --- File stat cache (inspired by clawmonitor's transcript_tail caching) ---
interface FileCache {
  mtimeMs: number;
  size: number;
  entries: MonitorEntry[];
}
const fileStatCache = new Map<string, FileCache>();

function entryKey(e: MonitorEntry): string {
  return `${e.timestamp}|${e.agent}|${e.direction}|${e.sessionId}`;
}

/** Map project directory encoded names back to readable names */
function decodeProjectDir(encoded: string): string {
  return encoded.replace(/^-/, '/').replace(/-/g, '/');
}

/** Extract a short project name from a decoded path */
function shortProjectName(decoded: string, rawDirName?: string): string {
  // Special case: claude-mem observer sessions decode to .../sessions
  // which is meaningless — use a descriptive label instead
  if (rawDirName?.includes('claude-mem')) return 'claude-mem';

  const parts = decoded.split('/').filter(Boolean);
  return parts[parts.length - 1] || decoded;
}

export interface MonitorEntry {
  timestamp: string;
  agent: string;
  direction: 'received' | 'sent' | 'system';
  content: string;
  project: string;
  sessionId: string;
  truncated: boolean;
  stopReason?: string;
  model?: string;
  /** Data source: claude-session, openclaw-main, cron-run */
  source: string;
  /** Event status: ok, error, running, delivered, unknown */
  status: string;
}

// --- Internal message patterns to filter ---
const INTERNAL_PATTERNS = [
  /^<system-reminder>/,
  /^<local-command-caveat>/,
  /^<available-deferred-tools>/,
  /^\[ClawMonitor/,
  /^Skills store policy/,
  /^Current date and time:/,
  /^You are an? /,
  /^<command-name>/,
  /^<command-message>/,
  /^<command-args>/,
];

function isInternalMessage(text: string): boolean {
  const trimmed = text.trim();
  return INTERNAL_PATTERNS.some((p) => p.test(trimmed));
}

/** Extract text content from a message, handling string/object/array formats */
function extractText(msg: unknown, maxChars = 500): { text: string; truncated: boolean } {
  let raw = '';

  if (typeof msg === 'string') {
    raw = msg;
  } else if (msg && typeof msg === 'object') {
    const m = msg as Record<string, unknown>;
    if (typeof m.content === 'string') {
      raw = m.content;
    } else if (Array.isArray(m.content)) {
      const parts: string[] = [];
      for (const block of m.content) {
        if (block?.type === 'text' && block.text) {
          parts.push(block.text);
        } else if (block?.type === 'tool_use') {
          parts.push(`[Tool: ${block.name}]`);
        } else if (block?.type === 'tool_result') {
          parts.push('[Tool Result]');
        }
      }
      raw = parts.join(' ').trim();
    }
  }

  // Strip known system/internal tags
  raw = raw
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
    .replace(/<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g, '')
    .replace(/<available-deferred-tools>[\s\S]*?<\/available-deferred-tools>/g, '')
    .replace(/<command-name>[\s\S]*?<\/command-name>/g, '')
    .replace(/<command-message>[\s\S]*?<\/command-message>/g, '')
    .replace(/<command-args>[\s\S]*?<\/command-args>/g, '')
    .replace(/<local-command-stdout>[\s\S]*?<\/local-command-stdout>/g, '')
    .trim();

  if (!raw) return { text: '', truncated: false };

  const truncated = raw.length > maxChars;
  return { text: raw.slice(0, maxChars), truncated };
}

// --- Cron job name lookup (cached) ---
let cronJobNames: Map<string, string> | null = null;
let cronJobsMtimeMs = 0;

function getCronJobNames(): Map<string, string> {
  try {
    if (!existsSync(CRON_JOBS_FILE)) return new Map();
    const stat = statSync(CRON_JOBS_FILE);
    if (cronJobNames && stat.mtimeMs === cronJobsMtimeMs) return cronJobNames;

    const data = JSON.parse(readFileSync(CRON_JOBS_FILE, 'utf-8'));
    const map = new Map<string, string>();
    if (Array.isArray(data.jobs)) {
      for (const job of data.jobs) {
        if (job.id && job.name) map.set(job.id, job.name);
      }
    }
    cronJobNames = map;
    cronJobsMtimeMs = stat.mtimeMs;
    return map;
  } catch {
    return new Map();
  }
}

/** Infer which agent produced a Claude session based on project context.
 *  rawDirName is the encoded directory name (e.g. '-Users-home--claude-mem-observer-sessions')
 *  which preserves keywords that get mangled by dash-to-slash decoding. */
function inferAgentFromProject(projName: string, entry: Record<string, unknown>, rawDirName?: string): string {
  const slug = String(entry.slug || '');
  const cwd = String(entry.cwd || '');
  const model = String(
    (entry.message as Record<string, unknown>)?.model || ''
  );

  // ACP sessions via openclaw are Silver (Claude coding agent)
  if (slug.includes('acp') || slug.includes('claude')) return 'Silver';
  if (cwd.includes('openclaw-command-center')) return 'Silver';

  // claude-mem observer sessions = Geo (check raw dir name because
  // decodeProjectDir turns 'claude-mem' into 'claude/mem', and
  // shortProjectName then yields just 'sessions')
  if (rawDirName?.includes('claude-mem')) return 'Geo';
  if (projName.includes('claude-mem')) return 'Geo';

  // openclaw-workspace with Sonnet model = Geo (research/writing sessions)
  if (rawDirName?.includes('openclaw-workspace') && model.includes('sonnet')) return 'Geo';

  // Research/summarization projects = Geo
  if (projName.includes('annotate') || projName.includes('research')) return 'Geo';

  // Default heuristic: Claude sessions = Silver unless identifiable otherwise
  return 'Silver';
}

// =========================================================================
// Data source 1: Claude session JSONL files (Silver, Geo)
// =========================================================================
function getClaudeSessionMessages(maxAgeMinutes: number, limit: number): MonitorEntry[] {
  const entries: MonitorEntry[] = [];
  const cutoff = Date.now() - maxAgeMinutes * 60_000;
  const seen = new Set<string>();

  if (!existsSync(PROJECTS_DIR)) return entries;

  try {
    const projectDirs = readdirSync(PROJECTS_DIR, { withFileTypes: true });

    for (const pd of projectDirs) {
      if (!pd.isDirectory()) continue;
      const projPath = join(PROJECTS_DIR, pd.name);
      const projName = shortProjectName(decodeProjectDir(pd.name), pd.name);

      let jsonlFiles: string[];
      try {
        jsonlFiles = readdirSync(projPath)
          .filter((f) => f.endsWith('.jsonl') && !f.includes('/'));
      } catch { continue; }

      for (const jf of jsonlFiles) {
        const filePath = join(projPath, jf);
        try {
          const stat = statSync(filePath);
          if (stat.mtimeMs < cutoff) continue;

          const isFresh = Date.now() - stat.mtimeMs < 120_000;
          const cached = fileStatCache.get(filePath);
          if (!isFresh && cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
            for (const ce of cached.entries) {
              const k = entryKey(ce);
              if (!seen.has(k) && new Date(ce.timestamp).getTime() >= cutoff) {
                seen.add(k);
                entries.push(ce);
              }
            }
            continue;
          }

          const content = readFileSync(filePath, 'utf-8');
          const lines = content.split('\n').filter(Boolean);
          const sessionId = basename(jf, '.jsonl');
          const fileEntries: MonitorEntry[] = [];

          for (let i = lines.length - 1; i >= 0 && fileEntries.length < limit * 2; i--) {
            try {
              const d = JSON.parse(lines[i]);
              const ts = d.timestamp;
              let tsMs: number;

              if (typeof ts === 'string') {
                tsMs = new Date(ts).getTime();
              } else if (typeof ts === 'number') {
                tsMs = ts;
              } else continue;

              if (tsMs < cutoff) break;

              const agent = inferAgentFromProject(projName, d, pd.name);

              if (d.type === 'user' && !d.isMeta) {
                const { text, truncated } = extractText(d.message);
                if (!text || text.length < 3) continue;
                if (isInternalMessage(text)) continue;

                fileEntries.push({
                  timestamp: new Date(tsMs).toISOString(),
                  agent,
                  direction: 'received',
                  content: text,
                  project: projName,
                  sessionId,
                  truncated,
                  source: 'claude-session',
                  status: 'ok',
                });
              } else if (d.type === 'assistant') {
                const { text, truncated } = extractText(d.message);
                if (!text || text.length < 2) continue;

                fileEntries.push({
                  timestamp: new Date(tsMs).toISOString(),
                  agent,
                  direction: 'sent',
                  content: text,
                  project: projName,
                  sessionId,
                  truncated,
                  stopReason: d.message?.stop_reason || d.stop_reason,
                  model: d.message?.model || d.model,
                  source: 'claude-session',
                  status: 'ok',
                });
              }
            } catch { continue; }
          }

          fileStatCache.set(filePath, { mtimeMs: stat.mtimeMs, size: stat.size, entries: fileEntries });

          for (const fe of fileEntries) {
            const k = entryKey(fe);
            if (!seen.has(k)) { seen.add(k); entries.push(fe); }
          }
        } catch { continue; }
      }
    }
  } catch { /* ignore */ }

  return entries;
}

// =========================================================================
// Data source 2: OpenClaw main agent sessions (Brodie)
// =========================================================================
function getBrodieMessages(maxAgeMinutes: number, limit: number): MonitorEntry[] {
  const entries: MonitorEntry[] = [];
  const cutoff = Date.now() - maxAgeMinutes * 60_000;

  if (!existsSync(BRODIE_SESSIONS_DIR)) return entries;

  try {
    const files = readdirSync(BRODIE_SESSIONS_DIR)
      .filter((f) => f.endsWith('.jsonl'));

    for (const jf of files) {
      const filePath = join(BRODIE_SESSIONS_DIR, jf);
      try {
        const stat = statSync(filePath);
        if (stat.mtimeMs < cutoff) continue;

        const isFresh = Date.now() - stat.mtimeMs < 120_000;
        const cached = fileStatCache.get(filePath);
        if (!isFresh && cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
          for (const ce of cached.entries) {
            if (new Date(ce.timestamp).getTime() >= cutoff) entries.push(ce);
          }
          continue;
        }

        const content = readFileSync(filePath, 'utf-8');
        const lines = content.split('\n').filter(Boolean);
        const sessionId = basename(jf, '.jsonl');
        const fileEntries: MonitorEntry[] = [];

        for (let i = lines.length - 1; i >= 0 && fileEntries.length < limit * 2; i--) {
          try {
            const d = JSON.parse(lines[i]);
            const ts = d.timestamp;
            let tsMs: number;

            if (typeof ts === 'string') {
              tsMs = new Date(ts).getTime();
            } else if (typeof ts === 'number') {
              tsMs = ts;
            } else continue;

            if (tsMs < cutoff) break;

            if (d.type !== 'message' || !d.message) continue;
            const role = d.message.role;
            if (!role || role === 'system') continue;

            const { text, truncated } = extractText(d.message);
            if (!text || text.length < 3) continue;
            if (isInternalMessage(text)) continue;

            // Brodie messages: user = received, assistant/toolResult = sent
            const direction: MonitorEntry['direction'] =
              role === 'user' ? 'received' : 'sent';

            fileEntries.push({
              timestamp: new Date(tsMs).toISOString(),
              agent: 'Brodie',
              direction,
              content: text,
              project: 'orchestrator',
              sessionId,
              truncated,
              model: d.message.model,
              source: 'openclaw-main',
              status: 'ok',
            });
          } catch { continue; }
        }

        fileStatCache.set(filePath, { mtimeMs: stat.mtimeMs, size: stat.size, entries: fileEntries });
        entries.push(...fileEntries);
      } catch { continue; }
    }
  } catch { /* ignore */ }

  return entries;
}

// =========================================================================
// Data source 3: Cron run logs (Echo)
// =========================================================================
function getEchoCronMessages(maxAgeMinutes: number, limit: number): MonitorEntry[] {
  const entries: MonitorEntry[] = [];
  const cutoff = Date.now() - maxAgeMinutes * 60_000;
  const jobNames = getCronJobNames();

  if (!existsSync(CRON_RUNS_DIR)) return entries;

  try {
    const files = readdirSync(CRON_RUNS_DIR)
      .filter((f) => f.endsWith('.jsonl'));

    for (const jf of files) {
      const filePath = join(CRON_RUNS_DIR, jf);
      try {
        const stat = statSync(filePath);
        if (stat.mtimeMs < cutoff) continue;

        const isFresh = Date.now() - stat.mtimeMs < 120_000;
        const cached = fileStatCache.get(filePath);
        if (!isFresh && cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
          for (const ce of cached.entries) {
            if (new Date(ce.timestamp).getTime() >= cutoff) entries.push(ce);
          }
          continue;
        }

        const content = readFileSync(filePath, 'utf-8');
        const lines = content.split('\n').filter(Boolean);
        const fileEntries: MonitorEntry[] = [];

        // Cron run files can be long; read from end
        for (let i = lines.length - 1; i >= 0 && fileEntries.length < limit; i--) {
          try {
            const d = JSON.parse(lines[i]);
            const tsMs = typeof d.ts === 'number' ? d.ts : 0;
            if (!tsMs || tsMs < cutoff) break;

            const jobId = d.jobId || basename(jf, '.jsonl');
            const jobName = jobNames.get(jobId) || jobId.slice(0, 8);
            const action = d.action || 'unknown';
            const runStatus = d.status || 'unknown';

            // Build content from available fields
            let summary = '';
            if (d.summary) {
              const { text, truncated: _ } = { text: String(d.summary).slice(0, 300), truncated: String(d.summary).length > 300 };
              summary = text;
            }

            const statusLabel = runStatus === 'ok' ? 'ok'
              : runStatus === 'error' ? 'error'
              : 'unknown';

            const contentParts: string[] = [`[${action}]`, jobName];
            if (runStatus !== 'ok') contentParts.push(`(${runStatus})`);
            if (d.durationMs) contentParts.push(`${Math.round(d.durationMs / 1000)}s`);
            if (d.deliveryStatus) contentParts.push(`delivery:${d.deliveryStatus}`);
            if (summary) contentParts.push(`— ${summary}`);

            const truncated = summary.length >= 300;

            fileEntries.push({
              timestamp: new Date(tsMs).toISOString(),
              agent: 'Echo',
              direction: action === 'finished' ? 'sent' : 'system',
              content: contentParts.join(' '),
              project: jobName,
              sessionId: d.sessionId || jobId,
              truncated,
              model: d.model,
              source: 'cron-run',
              status: statusLabel,
            });
          } catch { continue; }
        }

        fileStatCache.set(filePath, { mtimeMs: stat.mtimeMs, size: stat.size, entries: fileEntries });
        entries.push(...fileEntries);
      } catch { continue; }
    }
  } catch { /* ignore */ }

  return entries;
}

// =========================================================================
// Combined: merge all data sources
// =========================================================================
function getRecentMessages(maxAgeMinutes = 60, limit = 200): MonitorEntry[] {
  const perSource = Math.max(100, Math.floor(limit / 2));
  const claude = getClaudeSessionMessages(maxAgeMinutes, perSource);
  const brodie = getBrodieMessages(maxAgeMinutes, perSource);
  const echo = getEchoCronMessages(maxAgeMinutes, perSource);

  // Merge with guaranteed minimum representation from each source.
  // Without this, a high-volume source (Silver) can push all others out.
  const seen = new Set<string>();
  const sources = [
    { entries: claude, label: 'claude' },
    { entries: brodie, label: 'brodie' },
    { entries: echo, label: 'echo' },
  ];

  // Phase 1: guarantee each source gets up to minPerSource entries
  const minPerSource = Math.max(50, Math.floor(limit / 4));
  const reserved: MonitorEntry[] = [];
  for (const src of sources) {
    let count = 0;
    for (const e of src.entries) {
      if (count >= minPerSource) break;
      const k = entryKey(e);
      if (!seen.has(k)) {
        seen.add(k);
        reserved.push(e);
        count++;
      }
    }
  }

  // Phase 2: fill remaining slots up to limit with entries by recency
  const slotsLeft = limit - reserved.length;
  const remaining: MonitorEntry[] = [];
  for (const src of sources) {
    for (const e of src.entries) {
      const k = entryKey(e);
      if (!seen.has(k)) {
        seen.add(k);
        remaining.push(e);
      }
    }
  }
  remaining.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const final = [...reserved, ...remaining.slice(0, Math.max(0, slotsLeft))];
  final.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return final;
}

// =========================================================================
// Agent live status detection (used by Org Chart)
// =========================================================================

interface AgentLiveStatus {
  agentId: string;
  isActive: boolean;
  lastSeenAt: string | null;
  currentProject: string | null;
  currentTask: string | null;
  source: 'live';
  detectedVia?: 'process' | 'file_mtime' | 'cron_window' | 'orchestrator';
}

function detectLiveAgentActivity(): AgentLiveStatus[] {
  const results: AgentLiveStatus[] = [];
  const now = Date.now();

  // --- Silver ---
  let silverActive = false;
  let silverProject: string | null = null;
  let silverLastSeen: string | null = null;
  let silverDetectedVia: AgentLiveStatus['detectedVia'];

  try {
    const ps = execSync(
      'ps aux | grep -E "claude.*--output-format|acpx.*claude" | grep -v grep',
      { encoding: 'utf-8', timeout: 3000 }
    ).trim();
    if (ps) {
      silverActive = true;
      silverDetectedVia = 'process';
      const cwdMatch = ps.match(/--cwd\s+(\S+)/);
      if (cwdMatch) silverProject = shortProjectName(cwdMatch[1]);
      silverLastSeen = new Date().toISOString();
    }
  } catch { /* no process */ }

  if (!silverActive) {
    try {
      const recent = findMostRecentJsonl();
      if (recent && now - recent.mtimeMs < 5 * 60_000) {
        silverLastSeen = new Date(recent.mtimeMs).toISOString();
        silverProject = recent.project;
        silverDetectedVia = 'file_mtime';
      }
    } catch { /* ignore */ }
  }

  results.push({
    agentId: 'silver',
    isActive: silverActive,
    lastSeenAt: silverLastSeen,
    currentProject: silverProject,
    currentTask: silverActive ? `Working on ${silverProject || 'project'}` : null,
    source: 'live',
    detectedVia: silverDetectedVia,
  });

  // --- Geo ---
  let geoActive = false;
  let geoLastSeen: string | null = null;
  let geoDetectedVia: AgentLiveStatus['detectedVia'];

  try {
    const ps = execSync(
      'ps aux | grep -E "claude.*sonnet" | grep -v grep',
      { encoding: 'utf-8', timeout: 3000 }
    ).trim();
    if (ps) {
      geoActive = true;
      geoLastSeen = new Date().toISOString();
      geoDetectedVia = 'process';
    }
  } catch { /* ignore */ }

  if (!geoActive) {
    try {
      const memDir = join(PROJECTS_DIR, '-Users-home--claude-mem-observer-sessions');
      if (existsSync(memDir)) {
        const files = readdirSync(memDir).filter((f) => f.endsWith('.jsonl'));
        for (const f of files) {
          const stat = statSync(join(memDir, f));
          if (now - stat.mtimeMs < 5 * 60_000) {
            geoLastSeen = new Date(stat.mtimeMs).toISOString();
            geoDetectedVia = 'file_mtime';
            break;
          }
        }
      }
    } catch { /* ignore */ }
  }

  results.push({
    agentId: 'geo',
    isActive: geoActive,
    lastSeenAt: geoLastSeen,
    currentProject: null,
    currentTask: geoActive ? 'Research / writing session' : null,
    source: 'live',
    detectedVia: geoDetectedVia,
  });

  // --- Echo ---
  let echoActive = false;
  let echoLastSeen: string | null = null;
  let echoTask: string | null = null;
  let echoDetectedVia: AgentLiveStatus['detectedVia'];

  try {
    const ps = execSync(
      'ps aux | grep -E "openclaw.*cron|echo.*cron" | grep -v grep',
      { encoding: 'utf-8', timeout: 3000 }
    ).trim();
    if (ps) {
      echoActive = true;
      echoLastSeen = new Date().toISOString();
      echoTask = 'Executing cron job';
      echoDetectedVia = 'process';
    }
  } catch { /* ignore */ }

  if (!echoActive) {
    const hour = new Date().getHours();
    const minute = new Date().getMinutes();
    const nowMinutes = hour * 60 + minute;
    const cronWindows = [
      { h: 6, task: 'Morning briefing digest' },
      { h: 7, task: 'Medical research scan' },
      { h: 8, task: 'Financial monitoring' },
      { h: 12, task: 'Midday summary' },
      { h: 18, task: 'Evening portfolio check' },
      { h: 22, task: 'End-of-day reports' },
      { h: 23, task: 'Daily tweet summary' },
    ];

    const recentlyCompleted = cronWindows.find(
      (w) => nowMinutes >= w.h * 60 && nowMinutes < w.h * 60 + 20
    );

    if (recentlyCompleted) {
      const completedAt = new Date();
      completedAt.setHours(recentlyCompleted.h, 0, 0, 0);
      echoLastSeen = completedAt.toISOString();
      echoDetectedVia = 'cron_window';
      echoTask = `Completed: ${recentlyCompleted.task}`;
    }
  }

  results.push({
    agentId: 'echo',
    isActive: echoActive,
    lastSeenAt: echoLastSeen,
    currentProject: null,
    currentTask: echoTask,
    source: 'live',
    detectedVia: echoDetectedVia,
  });

  // --- Brodie ---
  const anyActive = results.some((r) => r.isActive);
  const activeNames = results.filter((r) => r.isActive).map((r) =>
    r.agentId.charAt(0).toUpperCase() + r.agentId.slice(1)
  );

  results.push({
    agentId: 'brodie',
    isActive: anyActive,
    lastSeenAt: anyActive ? new Date().toISOString() : results.reduce(
      (latest, r) => (r.lastSeenAt && r.lastSeenAt > (latest || '')) ? r.lastSeenAt : latest,
      null as string | null
    ),
    currentProject: null,
    currentTask: anyActive ? `Coordinating ${activeNames.join(', ')}` : null,
    source: 'live',
    detectedVia: anyActive ? 'orchestrator' : undefined,
  });

  return results;
}

/** Find the most recently modified JSONL in any Claude project session dir */
function findMostRecentJsonl(): { path: string; mtimeMs: number; project: string } | null {
  if (!existsSync(PROJECTS_DIR)) return null;

  let best: { path: string; mtimeMs: number; project: string } | null = null;

  try {
    const dirs = readdirSync(PROJECTS_DIR, { withFileTypes: true });
    for (const d of dirs) {
      if (!d.isDirectory()) continue;
      const dirPath = join(PROJECTS_DIR, d.name);
      try {
        const files = readdirSync(dirPath).filter((f) => f.endsWith('.jsonl') && !f.includes('/'));
        for (const f of files) {
          const fp = join(dirPath, f);
          const stat = statSync(fp);
          if (!best || stat.mtimeMs > best.mtimeMs) {
            best = {
              path: fp,
              mtimeMs: stat.mtimeMs,
              project: shortProjectName(decodeProjectDir(d.name)),
            };
          }
        }
      } catch { continue; }
    }
  } catch { /* ignore */ }

  return best;
}

// =========================================================================
// Vite plugin export
// =========================================================================

export default function monitorPlugin(): Plugin {
  return {
    name: 'vite-plugin-monitor',
    configureServer(server) {
      // Live agent activity endpoint
      server.middlewares.use('/api/agents/activity', (_req, res) => {
        try {
          const activity = detectLiveAgentActivity();
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify(activity));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(e) }));
        }
      });

      // Monitor messages endpoint
      server.middlewares.use('/api/monitor/messages', (req, res) => {
        try {
          const url = new URL(req.url || '/', 'http://localhost');
          const maxAge = parseInt(url.searchParams.get('maxAge') || '60', 10);
          const limit = parseInt(url.searchParams.get('limit') || '100', 10);
          const messages = getRecentMessages(
            Math.min(maxAge, 1440),
            Math.min(limit, 1000)
          );
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify(messages));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(e) }));
        }
      });
    },
  };
}
