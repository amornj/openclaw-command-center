import type { Plugin } from 'vite';
import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { execSync } from 'child_process';

const CLAUDE_DIR = join(process.env.HOME || '/Users/home', '.claude');
const PROJECTS_DIR = join(CLAUDE_DIR, 'projects');

// --- File stat cache (inspired by clawmonitor's transcript_tail caching) ---
// Avoids re-reading unchanged files by checking mtime + size
interface FileCache {
  mtimeMs: number;
  size: number;
  entries: MonitorEntry[];
}
const fileStatCache = new Map<string, FileCache>();

// --- Seen entry hashes for deduplication ---
function entryKey(e: MonitorEntry): string {
  return `${e.timestamp}|${e.agent}|${e.direction}|${e.sessionId}`;
}

/** Map project directory encoded names back to readable names */
function decodeProjectDir(encoded: string): string {
  return encoded.replace(/^-/, '/').replace(/-/g, '/');
}

/** Extract a short project name from a decoded path */
function shortProjectName(decoded: string): string {
  const parts = decoded.split('/').filter(Boolean);
  return parts[parts.length - 1] || decoded;
}

interface MonitorEntry {
  timestamp: string;
  agent: string;
  direction: 'received' | 'sent' | 'system';
  content: string;
  project: string;
  sessionId: string;
  /** Whether content was truncated */
  truncated: boolean;
  /** Stop reason from assistant response (if sent) */
  stopReason?: string;
  /** Model used (if available from assistant response) */
  model?: string;
}

// --- Internal message patterns to filter (adapted from clawmonitor) ---
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

/** Scan JSONL session files for recent messages with caching */
function getRecentMessages(maxAgeMinutes = 60, limit = 200): MonitorEntry[] {
  const entries: MonitorEntry[] = [];
  const cutoff = Date.now() - maxAgeMinutes * 60_000;
  const seen = new Set<string>();

  if (!existsSync(PROJECTS_DIR)) return entries;

  try {
    const projectDirs = readdirSync(PROJECTS_DIR, { withFileTypes: true });

    for (const pd of projectDirs) {
      if (!pd.isDirectory()) continue;
      const projPath = join(PROJECTS_DIR, pd.name);
      const projName = shortProjectName(decodeProjectDir(pd.name));

      let jsonlFiles: string[];
      try {
        jsonlFiles = readdirSync(projPath)
          .filter((f) => f.endsWith('.jsonl') && !f.includes('/'));
      } catch {
        continue;
      }

      for (const jf of jsonlFiles) {
        const filePath = join(projPath, jf);
        try {
          const stat = statSync(filePath);
          // Skip files not modified recently
          if (stat.mtimeMs < cutoff) continue;

          // File stat cache: skip re-parsing if file hasn't changed
          // Bypass cache for recently-modified files (< 2 min) to avoid serving
          // stale data from actively-written session files
          const isFresh = Date.now() - stat.mtimeMs < 120_000;
          const cached = fileStatCache.get(filePath);
          if (!isFresh && cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
            // Use cached entries, filtering by cutoff
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

          // Read from end for efficiency
          for (let i = lines.length - 1; i >= 0 && fileEntries.length < limit * 2; i--) {
            try {
              const d = JSON.parse(lines[i]);
              const ts = d.timestamp;
              let tsMs: number;

              if (typeof ts === 'string') {
                tsMs = new Date(ts).getTime();
              } else if (typeof ts === 'number') {
                tsMs = ts;
              } else {
                continue;
              }

              if (tsMs < cutoff) break; // older entries, stop

              if (d.type === 'user' && !d.isMeta) {
                const { text, truncated } = extractText(d.message);
                if (!text || text.length < 3) continue;
                if (isInternalMessage(text)) continue;

                const entry: MonitorEntry = {
                  timestamp: new Date(tsMs).toISOString(),
                  agent: inferAgentFromProject(projName, d),
                  direction: 'received',
                  content: text,
                  project: projName,
                  sessionId,
                  truncated,
                };
                fileEntries.push(entry);
              } else if (d.type === 'assistant') {
                const { text, truncated } = extractText(d.message);
                if (!text || text.length < 2) continue;

                const entry: MonitorEntry = {
                  timestamp: new Date(tsMs).toISOString(),
                  agent: inferAgentFromProject(projName, d),
                  direction: 'sent',
                  content: text,
                  project: projName,
                  sessionId,
                  truncated,
                  stopReason: d.message?.stop_reason || d.stop_reason,
                  model: d.message?.model || d.model,
                };
                fileEntries.push(entry);
              }
            } catch {
              continue;
            }
          }

          // Update cache
          fileStatCache.set(filePath, {
            mtimeMs: stat.mtimeMs,
            size: stat.size,
            entries: fileEntries,
          });

          // Add to results with deduplication
          for (const fe of fileEntries) {
            const k = entryKey(fe);
            if (!seen.has(k)) {
              seen.add(k);
              entries.push(fe);
            }
          }
        } catch {
          continue;
        }
      }
    }
  } catch {
    // PROJECTS_DIR read error
  }

  // Sort by timestamp descending
  entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return entries.slice(0, limit);
}

/** Infer which agent produced a session based on project context */
function inferAgentFromProject(projName: string, entry: Record<string, unknown>): string {
  const slug = String(entry.slug || '');
  const cwd = String(entry.cwd || '');

  // ACP sessions via openclaw are Silver (Claude coding agent)
  if (slug.includes('acp') || slug.includes('claude')) return 'Silver';
  if (cwd.includes('openclaw-command-center')) return 'Silver';

  // claude-mem observer sessions
  if (projName.includes('claude-mem')) return 'Geo';

  // Default heuristic: Claude sessions = Silver unless identifiable otherwise
  return 'Silver';
}

interface AgentLiveStatus {
  agentId: string;
  isActive: boolean;
  lastSeenAt: string | null;
  currentProject: string | null;
  currentTask: string | null;
  source: 'live';
  /** Working detection signal source */
  detectedVia?: 'process' | 'file_mtime' | 'cron_window' | 'orchestrator';
}

/** Detect actual agent activity from processes and file timestamps */
function detectLiveAgentActivity(): AgentLiveStatus[] {
  const results: AgentLiveStatus[] = [];
  const now = Date.now();

  // --- Silver: check for active Claude Code CLI processes ---
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
      if (cwdMatch) {
        silverProject = shortProjectName(cwdMatch[1]);
      }
      silverLastSeen = new Date().toISOString();
    }
  } catch {
    // No matching process
  }

  // Also check recent session JSONL files for Silver
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

  // --- Geo: check for Claude research sessions ---
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

  // --- Echo: check for cron-related processes or recent cron output ---
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

  // If no running cron process found, provide schedule context but do NOT
  // mark Echo as active — only real processes trigger active state
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

    // Find the most recently completed window (within last 20 min)
    const recentlyCompleted = cronWindows.find(
      (w) => nowMinutes >= w.h * 60 && nowMinutes < w.h * 60 + 20
    );

    if (recentlyCompleted) {
      // Recently finished — provide context but keep inactive
      const completedAt = new Date();
      completedAt.setHours(recentlyCompleted.h, 0, 0, 0);
      echoLastSeen = completedAt.toISOString();
      echoDetectedVia = 'cron_window';
      echoTask = `Completed: ${recentlyCompleted.task}`;
    }
    // echoActive stays false — only real process detection triggers active
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

  // --- Brodie: active when any other agent is active ---
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

/** Find the most recently modified JSONL in any project session dir */
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
            Math.min(limit, 500)
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
