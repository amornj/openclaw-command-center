/**
 * Usage data fetching for Claude and OpenAI APIs.
 *
 * Architecture:
 * 1. Try to fetch from local bridge API (/api/usage/claude, /api/usage/openai)
 * 2. Fall back to session-estimated data based on known rate limits
 *
 * To wire live data, run a small local API server that proxies:
 *   - Claude: https://api.anthropic.com/v1/messages/count_tokens (or billing API when available)
 *   - OpenAI: https://api.openai.com/v1/organization/usage
 */

export interface UsageProvider {
  name: string;
  icon: string;
  authMethod: string;
  models: ModelUsage[];
  rateLimits: RateLimit[];
  isLive: boolean;
}

export interface ModelUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  requests: number;
  costEstimate: number | null; // USD, null if OAuth (no billing)
}

export interface RateLimit {
  name: string;
  limit: number;
  used: number;
  unit: string;
  resetAt: string | null; // ISO datetime
  tier: string;
}

const USAGE_API = '/api/usage';

export async function fetchUsageData(): Promise<UsageProvider[]> {
  // Try live API first
  try {
    const res = await fetch(`${USAGE_API}`, { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      return (await res.json()) as UsageProvider[];
    }
  } catch {
    // No backend — fall through
  }

  return estimatedUsage();
}

/**
 * Estimated usage based on known OAuth tier rate limits.
 * These represent the user's known tier limits and estimated session activity.
 */
function estimatedUsage(): UsageProvider[] {
  const now = new Date();
  const minuteReset = new Date(now);
  minuteReset.setMinutes(minuteReset.getMinutes() + 1, 0, 0);
  const dayReset = new Date(now);
  dayReset.setHours(24, 0, 0, 0);

  return [
    {
      name: 'Anthropic (Claude)',
      icon: '🟣',
      authMethod: 'OAuth',
      isLive: false,
      models: [
        { model: 'claude-opus-4-6', inputTokens: 0, outputTokens: 0, requests: 0, costEstimate: null },
        { model: 'claude-sonnet-4-6', inputTokens: 0, outputTokens: 0, requests: 0, costEstimate: null },
        { model: 'claude-haiku-4-5', inputTokens: 0, outputTokens: 0, requests: 0, costEstimate: null },
      ],
      rateLimits: [
        { name: 'Requests / min', limit: 50, used: 0, unit: 'req', resetAt: minuteReset.toISOString(), tier: 'OAuth Free' },
        { name: 'Input tokens / min', limit: 40_000, used: 0, unit: 'tokens', resetAt: minuteReset.toISOString(), tier: 'OAuth Free' },
        { name: 'Output tokens / min', limit: 8_000, used: 0, unit: 'tokens', resetAt: minuteReset.toISOString(), tier: 'OAuth Free' },
        { name: 'Tokens / day', limit: 1_000_000, used: 0, unit: 'tokens', resetAt: dayReset.toISOString(), tier: 'OAuth Free' },
      ],
    },
    {
      name: 'OpenAI',
      icon: '🟢',
      authMethod: 'OAuth',
      isLive: false,
      models: [
        { model: 'gpt-4o', inputTokens: 0, outputTokens: 0, requests: 0, costEstimate: null },
        { model: 'gpt-4o-mini', inputTokens: 0, outputTokens: 0, requests: 0, costEstimate: null },
        { model: 'o3', inputTokens: 0, outputTokens: 0, requests: 0, costEstimate: null },
      ],
      rateLimits: [
        { name: 'Requests / min (GPT-4o)', limit: 500, used: 0, unit: 'req', resetAt: minuteReset.toISOString(), tier: 'Tier 5' },
        { name: 'Tokens / min (GPT-4o)', limit: 800_000, used: 0, unit: 'tokens', resetAt: minuteReset.toISOString(), tier: 'Tier 5' },
        { name: 'Requests / day', limit: 10_000, used: 0, unit: 'req', resetAt: dayReset.toISOString(), tier: 'Tier 5' },
      ],
    },
  ];
}
