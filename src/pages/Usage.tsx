import { useState, useEffect } from 'react';
import { fetchUsageData, type UsageProvider, type RateLimit } from '../data/usageData';

export default function Usage() {
  const [providers, setProviders] = useState<UsageProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const anyLive = providers.some((p) => p.isLive);

  useEffect(() => {
    let cancelled = false;
    load();
    const interval = setInterval(load, 15_000);
    return () => { cancelled = true; clearInterval(interval); };

    async function load() {
      const data = await fetchUsageData();
      if (cancelled) return;
      setProviders(data);
      setLoading(false);
    }
  }, []);

  return (
    <div className="usage-page">
      <div className="usage-header">
        <div>
          <h2>API Usage</h2>
          <p className="subtitle">
            Rate limits & consumption across providers
            <span className={`source-badge ${anyLive ? 'live' : 'derived'}`}>
              {anyLive ? '● Live' : '○ Estimated limits'}
            </span>
          </p>
        </div>
      </div>

      {!anyLive && (
        <div className="usage-notice">
          <span className="notice-icon">ℹ</span>
          <div>
            <strong>Showing known rate limits for your OAuth tiers.</strong> To wire live usage data,
            run a local API bridge at <code>/api/usage</code> that proxies Anthropic and OpenAI usage endpoints.
          </div>
        </div>
      )}

      {loading ? (
        <div className="cron-loading">Loading...</div>
      ) : (
        <div className="usage-providers">
          {providers.map((provider) => (
            <ProviderCard key={provider.name} provider={provider} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProviderCard({ provider }: { provider: UsageProvider }) {
  return (
    <div className="provider-card">
      <div className="provider-header">
        <div className="provider-name">
          <span className="provider-icon">{provider.icon}</span>
          <h3>{provider.name}</h3>
        </div>
        <div className="provider-badges">
          <span className="auth-badge">{provider.authMethod}</span>
          {provider.isLive && <span className="live-dot">● Live</span>}
        </div>
      </div>

      {/* Rate Limits */}
      <div className="rate-limits-section">
        <h4>Rate Limits</h4>
        <div className="rate-limits-grid">
          {provider.rateLimits.map((rl, i) => (
            <RateLimitBar key={i} rateLimit={rl} />
          ))}
        </div>
      </div>

      {/* Models */}
      <div className="models-section">
        <h4>Models</h4>
        <div className="models-grid">
          {provider.models.map((m, i) => (
            <div key={i} className="model-usage-card">
              <div className="model-usage-name">{m.model}</div>
              <div className="model-usage-stats">
                <div className="model-stat">
                  <span className="stat-value">{formatTokens(m.inputTokens)}</span>
                  <span className="stat-label">Input</span>
                </div>
                <div className="model-stat">
                  <span className="stat-value">{formatTokens(m.outputTokens)}</span>
                  <span className="stat-label">Output</span>
                </div>
                <div className="model-stat">
                  <span className="stat-value">{m.requests.toLocaleString()}</span>
                  <span className="stat-label">Requests</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RateLimitBar({ rateLimit }: { rateLimit: RateLimit }) {
  const pct = rateLimit.limit > 0 ? (rateLimit.used / rateLimit.limit) * 100 : 0;
  const color = pct > 90 ? '#f87171' : pct > 70 ? '#fbbf24' : pct > 40 ? '#38bdf8' : '#4ade80';
  const resetStr = rateLimit.resetAt ? formatReset(rateLimit.resetAt) : null;

  return (
    <div className="rate-limit-item">
      <div className="rl-header">
        <span className="rl-name">{rateLimit.name}</span>
        <span className="rl-values">
          {formatNumber(rateLimit.used)} / {formatNumber(rateLimit.limit)} {rateLimit.unit}
        </span>
      </div>
      <div className="rl-bar-track">
        <div className="rl-bar-fill" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
      <div className="rl-footer">
        <span className="rl-tier">{rateLimit.tier}</span>
        {resetStr && <span className="rl-reset">Resets {resetStr}</span>}
      </div>
    </div>
  );
}

function formatTokens(n: number): string {
  if (n === 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

function formatReset(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  if (diff < 0) return 'now';
  if (diff < 60_000) return `in ${Math.ceil(diff / 1000)}s`;
  if (diff < 3_600_000) return `in ${Math.ceil(diff / 60_000)}m`;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
