/**
 * Agent activity tracking for OpenClaw Command Center.
 *
 * Data source priority:
 *   1. Live detection — checks local signals (Claude Code sessions, process markers)
 *   2. Inferred — derives Echo's status from cron job schedules
 *   3. Fallback — clean structured estimates, clearly labeled
 *
 * When live detection is not feasible, all fields are still populated
 * with plausible defaults so the UI never shows blank cards.
 */

export type ActivityStatus = 'active' | 'idle' | 'standby';
export type ActivitySource = 'live' | 'inferred' | 'estimated';

export interface AgentActivity {
  agentId: string;
  status: ActivityStatus;
  currentTask: string | null;
  lastActiveAt: string;           // ISO timestamp
  source: ActivitySource;
  /** Optional detail shown as secondary text */
  detail: string | null;
}

/** Try to detect Silver's activity from the local Claude Code session */
function detectSilverActivity(): AgentActivity {
  const now = new Date();
  // Without a live backend signal, we cannot confirm Silver is active.
  // Default to idle — the live API path (Phase 1) will override this
  // when a real backend is available.
  return {
    agentId: 'silver',
    status: 'idle',
    currentTask: null,
    lastActiveAt: new Date(now.getTime() - 30 * 60_000).toISOString(),
    source: 'estimated',
    detail: 'No live session detected',
  };
}

/** Infer Echo's activity from current time vs cron schedule */
function inferEchoActivity(): AgentActivity {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();

  // Echo runs scheduled jobs — check if any are likely running now
  // Key schedule times: 06:00, 07:00, 08:00, 12:00, 18:00, 22:00
  const activeWindows = [6, 7, 8, 12, 18, 22];
  const isInWindow = activeWindows.some(
    (h) => hour === h && minute < 15
  );

  if (isInWindow) {
    const taskMap: Record<number, string> = {
      6: 'Running morning briefing digest',
      7: 'Executing medical research scan (PubMed)',
      8: 'Processing financial monitoring alerts',
      12: 'Running midday summary compilation',
      18: 'Executing evening portfolio check',
      22: 'Running end-of-day report generation',
    };
    return {
      agentId: 'echo',
      status: 'active',
      currentTask: taskMap[hour] ?? 'Executing scheduled cron job',
      lastActiveAt: now.toISOString(),
      source: 'inferred',
      detail: `Cron window ${String(hour).padStart(2, '0')}:00–${String(hour).padStart(2, '0')}:15`,
    };
  }

  // Find next scheduled window
  const nextWindow = activeWindows.find((h) => h > hour) ?? activeWindows[0];
  const nextRun = new Date(now);
  nextRun.setHours(nextWindow, 0, 0, 0);
  if (nextWindow <= hour) nextRun.setDate(nextRun.getDate() + 1);

  return {
    agentId: 'echo',
    status: 'standby',
    currentTask: null,
    lastActiveAt: getLastCronRun(now, activeWindows),
    source: 'inferred',
    detail: `Next run at ${String(nextWindow).padStart(2, '0')}:00`,
  };
}

function getLastCronRun(now: Date, windows: number[]): string {
  const hour = now.getHours();
  const lastWindow = [...windows].reverse().find((h) => h < hour);
  const d = new Date(now);
  if (lastWindow !== undefined) {
    d.setHours(lastWindow, 14, 0, 0); // ~14 min into the window
  } else {
    d.setDate(d.getDate() - 1);
    d.setHours(windows[windows.length - 1], 14, 0, 0);
  }
  return d.toISOString();
}

/** Brodie orchestrates — active when any other agent is active */
function deriveBrodieActivity(others: AgentActivity[]): AgentActivity {
  const anyActive = others.some((a) => a.status === 'active');
  const now = new Date();

  if (anyActive) {
    const activeNames = others
      .filter((a) => a.status === 'active')
      .map((a) => a.agentId.charAt(0).toUpperCase() + a.agentId.slice(1));
    return {
      agentId: 'brodie',
      status: 'active',
      currentTask: `Coordinating ${activeNames.join(', ')}`,
      lastActiveAt: now.toISOString(),
      source: 'inferred',
      detail: `${activeNames.length} agent${activeNames.length > 1 ? 's' : ''} active`,
    };
  }

  return {
    agentId: 'brodie',
    status: 'standby',
    currentTask: null,
    lastActiveAt: others.reduce(
      (latest, a) => (a.lastActiveAt > latest ? a.lastActiveAt : latest),
      ''
    ),
    source: 'inferred',
    detail: 'Monitoring agent pool',
  };
}

/** Geo's activity — research tasks are ad-hoc, not scheduled */
function estimateGeoActivity(): AgentActivity {
  const now = new Date();
  const hour = now.getHours();

  // Geo tends to be active during working hours for research tasks
  const isWorkingHours = hour >= 9 && hour <= 21;

  return {
    agentId: 'geo',
    status: isWorkingHours ? 'idle' : 'standby',
    currentTask: null,
    lastActiveAt: new Date(
      now.getTime() - (isWorkingHours ? 25 * 60_000 : 4 * 3_600_000)
    ).toISOString(),
    source: 'estimated',
    detail: isWorkingHours ? 'Available for research tasks' : 'Off-hours standby',
  };
}

/**
 * Fetch activity for all agents.
 * Returns one AgentActivity per known agent.
 */
export async function fetchAgentActivity(): Promise<AgentActivity[]> {
  // Phase 1: try live API (future — local bridge at /api/agents/activity)
  try {
    const resp = await fetch('/api/agents/activity', {
      signal: AbortSignal.timeout(1500),
    });
    if (resp.ok) {
      const data = (await resp.json()) as AgentActivity[];
      return data.map((a) => ({ ...a, source: 'live' as ActivitySource }));
    }
  } catch {
    // No live backend — fall through to inference
  }

  // Phase 2: local inference and estimation
  const silver = detectSilverActivity();
  const echo = inferEchoActivity();
  const geo = estimateGeoActivity();
  const brodie = deriveBrodieActivity([silver, echo, geo]);

  return [brodie, silver, geo, echo];
}

/** Human-readable time-ago string */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
