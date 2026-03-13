/**
 * Local session usage tracking for OpenClaw Command Center.
 *
 * Tracks actual runtime usage from this app's perspective:
 * - Browser session activity (pages visited, time active)
 * - Cron check polls (API calls made by auto-refresh features)
 * - Local storage persistence across page reloads
 *
 * This is the PRIMARY usage data source. Provider-level API bridges
 * (Anthropic billing, OpenAI org usage) are optional future additions.
 */

const STORAGE_KEY = 'openclaw_session_usage';

export interface SessionStats {
  /** When this session tracking started */
  sessionStart: string;
  /** Total time the app has been open (ms) */
  activeTimeMs: number;
  /** Page navigation count */
  pageViews: number;
  /** Auto-refresh polls (cron status, usage refresh, etc.) */
  refreshPolls: number;
  /** Per-feature breakdown */
  features: FeatureUsage[];
  /** Timestamp of last activity */
  lastActivity: string;
}

export interface FeatureUsage {
  name: string;
  /** How many times this feature was accessed */
  accessCount: number;
  /** Total auto-refresh cycles triggered */
  pollCount: number;
  /** Last accessed timestamp */
  lastAccessed: string | null;
}

const DEFAULT_FEATURES: FeatureUsage[] = [
  { name: 'Org Chart', accessCount: 0, pollCount: 0, lastAccessed: null },
  { name: 'Calendar', accessCount: 0, pollCount: 0, lastAccessed: null },
  { name: 'Cron Tracker', accessCount: 0, pollCount: 0, lastAccessed: null },
  { name: 'Usage', accessCount: 0, pollCount: 0, lastAccessed: null },
];

function defaultStats(): SessionStats {
  const now = new Date().toISOString();
  return {
    sessionStart: now,
    activeTimeMs: 0,
    pageViews: 0,
    refreshPolls: 0,
    features: DEFAULT_FEATURES.map((f) => ({ ...f })),
    lastActivity: now,
  };
}

/** Load persisted session stats from localStorage */
export function loadSessionStats(): SessionStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SessionStats;
      // Ensure all features exist (handles upgrades)
      for (const def of DEFAULT_FEATURES) {
        if (!parsed.features.find((f) => f.name === def.name)) {
          parsed.features.push({ ...def });
        }
      }
      return parsed;
    }
  } catch {
    // Corrupted — start fresh
  }
  return defaultStats();
}

/** Persist session stats to localStorage */
function saveStats(stats: SessionStats): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // Storage full or unavailable — silently continue
  }
}

/** Record a page view for a feature */
export function trackPageView(featureName: string): void {
  const stats = loadSessionStats();
  stats.pageViews += 1;
  stats.lastActivity = new Date().toISOString();
  const feature = stats.features.find((f) => f.name === featureName);
  if (feature) {
    feature.accessCount += 1;
    feature.lastAccessed = stats.lastActivity;
  }
  saveStats(stats);
}

/** Record an auto-refresh poll (cron status check, usage refresh, etc.) */
export function trackRefreshPoll(featureName?: string): void {
  const stats = loadSessionStats();
  stats.refreshPolls += 1;
  stats.lastActivity = new Date().toISOString();
  if (featureName) {
    const feature = stats.features.find((f) => f.name === featureName);
    if (feature) {
      feature.pollCount += 1;
    }
  }
  saveStats(stats);
}

/** Update active time tracking (call periodically) */
export function tickActiveTime(deltaMs: number): void {
  const stats = loadSessionStats();
  stats.activeTimeMs += deltaMs;
  stats.lastActivity = new Date().toISOString();
  saveStats(stats);
}

/** Reset session stats (e.g., user wants a fresh session) */
export function resetSessionStats(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** Format milliseconds as human-readable duration */
export function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}
