/**
 * Usage data for OpenClaw Command Center.
 *
 * Architecture (priority order):
 * 1. LOCAL SESSION DATA (primary) — real usage tracked by the app itself
 *    via localStorage. Always available, always live.
 * 2. PROVIDER API BRIDGE (optional/future) — proxy to Anthropic/OpenAI
 *    billing APIs at /api/usage. Only used when a backend is running.
 *
 * The local session layer tracks what OpenClaw actually does: page views,
 * auto-refresh polls, feature usage, and active time. This is the data
 * users see by default. Provider-level token/billing data is supplemental.
 */

import { loadSessionStats, type SessionStats } from './sessionUsage';

// ── Shared types ──────────────────────────────────────────────────

export interface UsageProvider {
  name: string;
  icon: string;
  source: 'local' | 'provider-bridge';
  models: ModelUsage[];
  rateLimits: RateLimit[];
  isLive: boolean;
}

export interface ModelUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  requests: number;
  costEstimate: number | null;
}

export interface RateLimit {
  name: string;
  limit: number;
  used: number;
  unit: string;
  resetAt: string | null;
  tier: string;
}

// ── Local session usage (primary) ─────────────────────────────────

export interface LocalUsageSummary {
  session: SessionStats;
  uptime: number; // ms since session start
}

export function fetchLocalUsage(): LocalUsageSummary {
  const session = loadSessionStats();
  const uptime = Date.now() - new Date(session.sessionStart).getTime();
  return { session, uptime };
}

// ── Provider bridge (optional / future) ───────────────────────────

const PROVIDER_API = '/api/usage';

export async function fetchProviderUsage(): Promise<UsageProvider[] | null> {
  try {
    const res = await fetch(PROVIDER_API, { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      const data = (await res.json()) as UsageProvider[];
      return data.map((p) => ({ ...p, source: 'provider-bridge' as const, isLive: true }));
    }
  } catch {
    // No backend running — this is expected and fine
  }
  return null;
}

// ── Combined fetch (local first, provider optional) ───────────────

export interface CombinedUsage {
  local: LocalUsageSummary;
  providers: UsageProvider[] | null; // null = bridge not available
}

export async function fetchUsageData(): Promise<CombinedUsage> {
  const local = fetchLocalUsage();
  const providers = await fetchProviderUsage();
  return { local, providers };
}
