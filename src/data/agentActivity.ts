/**
 * Agent activity tracking for OpenClaw Command Center.
 *
 * Data source priority:
 *   1. Live detection — /api/agents/activity checks real processes + session files
 *   2. Inferred — schedule-based for Echo
 *   3. Fallback — clean structured estimates, clearly labeled
 *
 * The Org Chart bug (agents falsely showing active or stale tasks) was caused by:
 *   - No live backend existed, so the live fetch always failed
 *   - Fallback functions used optimistic heuristics that returned stale/wrong states
 *   - Now the Vite plugin provides real process + filesystem detection
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

/** Shape returned by the Vite plugin /api/agents/activity */
interface LiveStatus {
  agentId: string;
  isActive: boolean;
  lastSeenAt: string | null;
  currentProject: string | null;
  currentTask: string | null;
  source: 'live';
}

/** Convert live process detection to UI-ready AgentActivity */
function liveToActivity(live: LiveStatus): AgentActivity {
  const now = new Date();

  if (live.isActive) {
    return {
      agentId: live.agentId,
      status: 'active',
      currentTask: live.currentTask,
      lastActiveAt: live.lastSeenAt || now.toISOString(),
      source: 'live',
      detail: live.currentProject ? `Project: ${live.currentProject}` : null,
    };
  }

  // Not active — determine idle vs standby
  const lastSeen = live.lastSeenAt ? new Date(live.lastSeenAt).getTime() : 0;
  const minutesSince = lastSeen ? (Date.now() - lastSeen) / 60_000 : Infinity;

  return {
    agentId: live.agentId,
    status: minutesSince < 30 ? 'idle' : 'standby',
    currentTask: null,
    lastActiveAt: live.lastSeenAt || new Date(now.getTime() - 60 * 60_000).toISOString(),
    source: 'live',
    detail: lastSeen
      ? `Last seen ${timeAgo(live.lastSeenAt!)}`
      : 'No recent activity detected',
  };
}

/**
 * Fetch activity for all agents.
 * Prefers live data from the Vite plugin; falls back to local inference.
 */
export async function fetchAgentActivity(): Promise<AgentActivity[]> {
  // Try live API — served by vite-plugin-monitor
  try {
    const resp = await fetch('/api/agents/activity', {
      signal: AbortSignal.timeout(2000),
    });
    if (resp.ok) {
      const liveData = (await resp.json()) as LiveStatus[];
      if (Array.isArray(liveData) && liveData.length > 0) {
        return liveData.map(liveToActivity);
      }
    }
  } catch {
    // No live backend — fall through to inference
  }

  // Fallback: local inference (conservative — prefer idle over false active)
  const silver = fallbackSilver();
  const echo = fallbackEcho();
  const geo = fallbackGeo();
  const brodie = fallbackBrodie([silver, echo, geo]);

  return [brodie, silver, geo, echo];
}

// --- Fallback functions (used only when live API is unavailable) ---

function fallbackSilver(): AgentActivity {
  return {
    agentId: 'silver',
    status: 'idle',
    currentTask: null,
    lastActiveAt: new Date(Date.now() - 30 * 60_000).toISOString(),
    source: 'estimated',
    detail: 'Live detection unavailable',
  };
}

function fallbackEcho(): AgentActivity {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();

  const activeWindows = [6, 7, 8, 12, 18, 22];
  const isInWindow = activeWindows.some((h) => hour === h && minute < 15);

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

  const nextWindow = activeWindows.find((h) => h > hour) ?? activeWindows[0];
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
    d.setHours(lastWindow, 14, 0, 0);
  } else {
    d.setDate(d.getDate() - 1);
    d.setHours(windows[windows.length - 1], 14, 0, 0);
  }
  return d.toISOString();
}

function fallbackGeo(): AgentActivity {
  const now = new Date();
  const hour = now.getHours();
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

function fallbackBrodie(others: AgentActivity[]): AgentActivity {
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

/** Human-readable time-ago string */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
