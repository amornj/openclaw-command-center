/**
 * Monitor data layer — fetches agent message/log activity
 * from the live Vite plugin endpoint.
 *
 * Data source: live local Claude session JSONL files
 */

export interface MonitorEntry {
  timestamp: string;
  agent: string;
  direction: 'received' | 'sent' | 'system';
  content: string;
  project: string;
  sessionId: string;
}

export type MonitorFilter = {
  agent?: string;
  direction?: 'received' | 'sent' | 'system' | 'all';
  search?: string;
};

/**
 * Fetch recent monitor messages from the live endpoint.
 * Falls back to empty array if backend is unavailable.
 */
export async function fetchMonitorMessages(
  maxAgeMinutes = 60,
  limit = 100
): Promise<MonitorEntry[]> {
  try {
    const resp = await fetch(
      `/api/monitor/messages?maxAge=${maxAgeMinutes}&limit=${limit}`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (resp.ok) {
      return (await resp.json()) as MonitorEntry[];
    }
  } catch {
    // Backend unavailable
  }
  return [];
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
};
