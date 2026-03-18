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

/**
 * Health class for visual treatment (adapted from clawmonitor's health_class).
 * Decouples state computation from visual representation.
 */
export type HealthClass = 'ok' | 'working' | 'idle' | 'alert';

export interface AgentActivity {
  agentId: string;
  status: ActivityStatus;
  currentTask: string | null;
  lastActiveAt: string;           // ISO timestamp
  source: ActivitySource;
  /** Optional detail shown as secondary text */
  detail: string | null;
  /** How the working state was detected */
  detectedVia?: string;
  /** Health class for visual mapping */
  healthClass: HealthClass;
}

/** Shape returned by the Vite plugin /api/agents/activity */
interface LiveStatus {
  agentId: string;
  isActive: boolean;
  lastSeenAt: string | null;
  currentProject: string | null;
  currentTask: string | null;
  source: 'live';
  detectedVia?: string;
}

/** Compute health class from status */
function computeHealthClass(status: ActivityStatus): HealthClass {
  switch (status) {
    case 'active': return 'working';
    case 'idle': return 'idle';
    case 'standby': return 'ok';
  }
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
      detectedVia: live.detectedVia,
      healthClass: 'working',
    };
  }

  // Not active — determine idle vs standby
  const lastSeen = live.lastSeenAt ? new Date(live.lastSeenAt).getTime() : 0;
  const minutesSince = lastSeen ? (Date.now() - lastSeen) / 60_000 : Infinity;
  const status: ActivityStatus = minutesSince < 30 ? 'idle' : 'standby';

  // Echo-specific: show richer detail for recently completed cron jobs
  let detail: string | null = null;
  if (live.agentId === 'echo') {
    if (live.currentTask?.startsWith('Completed:')) {
      // Backend detected a recently completed cron window
      detail = live.currentTask;
    } else if (lastSeen && minutesSince < 20) {
      detail = `Finished ${timeAgo(live.lastSeenAt!)}`;
    } else {
      detail = echoNextRunDetail(now);
    }
  } else {
    detail = lastSeen
      ? `Last seen ${timeAgo(live.lastSeenAt!)}`
      : 'No recent activity detected';
  }

  return {
    agentId: live.agentId,
    status,
    currentTask: null,
    lastActiveAt: live.lastSeenAt || new Date(now.getTime() - 60 * 60_000).toISOString(),
    source: 'live',
    detail,
    detectedVia: live.detectedVia,
    healthClass: computeHealthClass(status),
  };
}

/** Compute Echo's "next run" detail from cron schedule */
function echoNextRunDetail(now: Date): string {
  const hour = now.getHours();
  const cronHours = [6, 7, 8, 12, 18, 22, 23];
  const next = cronHours.find((h) => h > hour) ?? cronHours[0];
  return `Next run at ${String(next).padStart(2, '0')}:00`;
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
  const harvey = fallbackHarvey();
  const hunter = fallbackHunter();
  const brodie = fallbackBrodie([silver, echo, geo, harvey, hunter]);

  return [brodie, silver, geo, echo, harvey, hunter];
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
    healthClass: 'idle',
  };
}

function fallbackEcho(): AgentActivity {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();

  // Never assume active from time window alone — only real process detection
  // should trigger active state. Provide schedule context instead.
  const cronWindows = [
    { h: 6, task: 'Morning briefing digest' },
    { h: 7, task: 'Medical research scan (PubMed)' },
    { h: 8, task: 'Financial monitoring alerts' },
    { h: 12, task: 'Midday summary compilation' },
    { h: 18, task: 'Evening portfolio check' },
    { h: 22, task: 'End-of-day report generation' },
    { h: 23, task: 'Daily tweet summary' },
  ];
  const cronHours = cronWindows.map((w) => w.h);

  // Check if we're within 20 min after a cron window (recently completed)
  const recentlyCompleted = cronWindows.find(
    (w) => hour === w.h && minute < 20
  );

  if (recentlyCompleted) {
    return {
      agentId: 'echo',
      status: 'idle',
      currentTask: null,
      lastActiveAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), recentlyCompleted.h, 0).toISOString(),
      source: 'inferred',
      detail: `Completed: ${recentlyCompleted.task}`,
      healthClass: 'idle',
    };
  }

  const nextWindow = cronHours.find((h) => h > hour) ?? cronHours[0];
  return {
    agentId: 'echo',
    status: 'standby',
    currentTask: null,
    lastActiveAt: getLastCronRun(now, cronHours),
    source: 'inferred',
    detail: `Next run at ${String(nextWindow).padStart(2, '0')}:00`,
    healthClass: 'ok',
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
  const status: ActivityStatus = isWorkingHours ? 'idle' : 'standby';

  return {
    agentId: 'geo',
    status,
    currentTask: null,
    lastActiveAt: new Date(
      now.getTime() - (isWorkingHours ? 25 * 60_000 : 4 * 3_600_000)
    ).toISOString(),
    source: 'estimated',
    detail: isWorkingHours ? 'Available for research tasks' : 'Off-hours standby',
    healthClass: computeHealthClass(status),
  };
}

function fallbackHarvey(): AgentActivity {
  return {
    agentId: 'harvey',
    status: 'standby',
    currentTask: null,
    lastActiveAt: new Date(Date.now() - 24 * 3_600_000).toISOString(),
    source: 'estimated',
    detail: 'On-demand: code review & secondary coding',
    healthClass: 'ok',
  };
}

function fallbackHunter(): AgentActivity {
  return {
    agentId: 'hunter',
    status: 'standby',
    currentTask: null,
    lastActiveAt: new Date(Date.now() - 24 * 3_600_000).toISOString(),
    source: 'estimated',
    detail: 'Awaiting visual tasks',
    healthClass: 'ok',
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
      healthClass: 'working',
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
    healthClass: 'ok',
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
