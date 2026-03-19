/**
 * Monitor data layer — fetches agent message/log activity
 * from the live Vite plugin endpoint.
 *
 * Data source: live local Claude session JSONL files
 *
 * Patterns adapted from clawmonitor:
 *   - Ring buffer for bounded memory
 *   - Deduplication via entry keys
 *   - Health class abstraction for visual mapping
 */

export interface MonitorEntry {
  timestamp: string;
  agent: string;
  direction: 'received' | 'sent' | 'system';
  content: string;
  project: string;
  sessionId: string;
  /** Whether content was truncated on the backend */
  truncated: boolean;
  /** Stop reason from assistant (end_turn, tool_use, etc.) */
  stopReason?: string;
  /** Model used */
  model?: string;
  /** Data source: claude-session, openclaw-main, cron-run */
  source?: string;
  /** Event status: ok, error, running, delivered, unknown */
  status?: string;
  /** Cron lifecycle stage: started, finished, succeeded, failed, delivered, delivery-failed */
  lifecycle?: string;
  /** Duration in milliseconds (for cron jobs) */
  durationMs?: number;
  /** Next scheduled run (ISO string, for cron jobs) */
  nextRun?: string;
  /** Delivery status string (for cron jobs) */
  deliveryStatus?: string;
}

export type MonitorFilter = {
  agent?: string;
  direction?: 'received' | 'sent' | 'system' | 'all';
  search?: string;
};

/** Health class for visual mapping (inspired by clawmonitor state.py) */
export type HealthClass = 'ok' | 'working' | 'idle' | 'alert';

/**
 * Ring buffer: keeps at most `maxSize` entries, dropping oldest.
 * Prevents unbounded memory growth during long sessions.
 */
const RING_MAX = 1500;
let ringBuffer: MonitorEntry[] = [];
/** Merge new entries into ring buffer, deduplicating by key */
export function mergeIntoBuffer(newEntries: MonitorEntry[]): MonitorEntry[] {
  if (newEntries.length === 0) return ringBuffer;

  const existingKeys = new Set(ringBuffer.map(entryKey));
  const fresh = newEntries.filter((e) => !existingKeys.has(entryKey(e)));

  if (fresh.length > 0) {
    ringBuffer = [...ringBuffer, ...fresh]
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    // Trim to ring buffer max
    if (ringBuffer.length > RING_MAX) {
      ringBuffer = ringBuffer.slice(ringBuffer.length - RING_MAX);
    }
  }

  return ringBuffer;
}

/** Get current buffer contents (newest last) */
export function getBuffer(): MonitorEntry[] {
  return ringBuffer;
}

/** Clear the ring buffer */
export function clearBuffer(): void {
  ringBuffer = [];
}

/** Entry dedup key */
function entryKey(e: MonitorEntry): string {
  return `${e.timestamp}|${e.agent}|${e.direction}|${e.sessionId}`;
}

/**
 * Fetch recent monitor messages from the live endpoint.
 * Falls back to empty array if backend is unavailable.
 */
export async function fetchMonitorMessages(
  maxAgeMinutes = 60,
  limit = 200
): Promise<MonitorEntry[]> {
  try {
    const resp = await fetch(
      `/api/monitor/messages?maxAge=${maxAgeMinutes}&limit=${limit}`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (resp.ok) {
      const data = (await resp.json()) as MonitorEntry[];
      return mergeIntoBuffer(data);
    }
  } catch {
    // Backend unavailable
  }
  return ringBuffer;
}

/** Filter entries client-side */
export function filterEntries(
  entries: MonitorEntry[],
  filter: MonitorFilter
): MonitorEntry[] {
  return entries.filter((e) => {
    if (filter.agent && filter.agent !== 'all' && e.agent !== filter.agent) return false;
    if (filter.direction && filter.direction !== 'all' && e.direction !== filter.direction) return false;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      return (
        e.content.toLowerCase().includes(q) ||
        e.agent.toLowerCase().includes(q) ||
        e.project.toLowerCase().includes(q)
      );
    }
    return true;
  });
}

/** Format timestamp for display */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/** Agent display colors */
export const agentColors: Record<string, string> = {
  Silver: '#a78bfa',
  Brodie: '#60a5fa',
  Geo: '#34d399',
  Echo: '#fbbf24',
  Harvey: '#f59e0b',
  Hunter: '#ec4899',
  Shin: '#64748b',
};

/** Map agent status to health class for consistent visual treatment */
export function healthClass(
  isActive: boolean,
  hasAlert: boolean = false,
  isIdle: boolean = false
): HealthClass {
  if (hasAlert) return 'alert';
  if (isActive) return 'working';
  if (isIdle) return 'idle';
  return 'ok';
}
