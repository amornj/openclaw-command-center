import { useState, useEffect, useRef } from 'react';
import {
  fetchUsageData,
  type CombinedUsage,
  type UsageProvider,
  type RateLimit,
} from '../data/usageData';
import {
  trackPageView,
  trackRefreshPoll,
  tickActiveTime,
  resetSessionStats,
  formatDuration,
  type SessionStats,
  type FeatureUsage,
} from '../data/sessionUsage';

export default function Usage() {
  const [data, setData] = useState<CombinedUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const tickRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    trackPageView('Usage');

    let cancelled = false;
    load();
    const pollInterval = setInterval(() => {
      trackRefreshPoll('Usage');
      load();
    }, 15_000);

    // Tick active time every 10s
    tickRef.current = setInterval(() => tickActiveTime(10_000), 10_000);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
      clearInterval(tickRef.current);
    };

    async function load() {
      const result = await fetchUsageData();
      if (cancelled) return;
      setData(result);
      setLoading(false);
    }
  }, []);

  const hasBridge = data?.providers != null;

  return (
    <div className="usage-page">
      <div className="usage-header">
        <div>
          <h2>Usage</h2>
          <p className="subtitle">
            Live session activity & resource tracking
            <span className="source-badge live">● Local Session</span>
            {hasBridge && <span className="source-badge live" style={{ marginLeft: 6 }}>● Provider Bridge</span>}
          </p>
        </div>
      </div>

      {loading || !data ? (
        <div className="cron-loading">Loading...</div>
      ) : (
        <>
          {/* ── Primary: Local session usage ── */}
          <SessionCard session={data.local.session} uptime={data.local.uptime} />

          {/* ── Optional: Provider bridge data ── */}
          {hasBridge ? (
            <div className="usage-providers">
              <h3 className="section-divider">Provider API Usage (Live Bridge)</h3>
              {data.providers!.map((provider) => (
                <ProviderCard key={provider.name} provider={provider} />
              ))}
            </div>
          ) : (
            <div className="usage-notice" style={{ marginTop: 20 }}>
              <span className="notice-icon">ℹ</span>
              <div>
                <strong>Provider-level usage is optional.</strong> To see token counts and billing
                from Anthropic/OpenAI, run a local bridge at <code>/api/usage</code>.
                The session data above is always live and requires no setup.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Local session card (primary) ──────────────────────────────────

function SessionCard({ session, uptime }: { session: SessionStats; uptime: number }) {
  const started = new Date(session.sessionStart);
  const lastAct = new Date(session.lastActivity);

  return (
    <div className="provider-card">
      <div className="provider-header">
        <div className="provider-name">
          <span className="provider-icon">🐾</span>
          <h3>OpenClaw Session</h3>
        </div>
        <div className="provider-badges">
          <span className="auth-badge">Local</span>
          <span className="live-dot">● Live</span>
          <button
            className="reset-btn"
            onClick={() => { resetSessionStats(); window.location.reload(); }}
            title="Reset session stats"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Session stats grid */}
      <div className="rate-limits-section">
        <h4>Session Overview</h4>
        <div className="session-stats-grid">
          <StatBox label="Uptime" value={formatDuration(uptime)} />
          <StatBox label="Active Time" value={formatDuration(session.activeTimeMs)} />
          <StatBox label="Page Views" value={session.pageViews.toLocaleString()} />
          <StatBox label="Auto-Refresh Polls" value={session.refreshPolls.toLocaleString()} />
          <StatBox
            label="Session Started"
            value={started.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          />
          <StatBox
            label="Last Activity"
            value={lastAct.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          />
        </div>
      </div>

      {/* Per-feature breakdown */}
      <div className="models-section">
        <h4>Feature Usage</h4>
        <div className="models-grid">
          {session.features.map((f) => (
            <FeatureCard key={f.name} feature={f} />
          ))}
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="session-stat-box">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

function FeatureCard({ feature }: { feature: FeatureUsage }) {
  const lastStr = feature.lastAccessed
    ? new Date(feature.lastAccessed).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Never';

  return (
    <div className="model-usage-card">
      <div className="model-usage-name">{feature.name}</div>
      <div className="model-usage-stats">
        <div className="model-stat">
          <span className="stat-value">{feature.accessCount}</span>
          <span className="stat-label">Views</span>
        </div>
        <div className="model-stat">
          <span className="stat-value">{feature.pollCount}</span>
          <span className="stat-label">Polls</span>
        </div>
        <div className="model-stat">
          <span className="stat-value">{lastStr}</span>
          <span className="stat-label">Last Used</span>
        </div>
      </div>
    </div>
  );
}

// ── Provider card (optional bridge) ───────────────────────────────

function ProviderCard({ provider }: { provider: UsageProvider }) {
  return (
    <div className="provider-card">
      <div className="provider-header">
        <div className="provider-name">
          <span className="provider-icon">{provider.icon}</span>
          <h3>{provider.name}</h3>
        </div>
        <div className="provider-badges">
          <span className="auth-badge">Bridge</span>
          {provider.isLive && <span className="live-dot">● Live</span>}
        </div>
      </div>

      <div className="rate-limits-section">
        <h4>Rate Limits</h4>
        <div className="rate-limits-grid">
          {provider.rateLimits.map((rl, i) => (
            <RateLimitBar key={i} rateLimit={rl} />
          ))}
        </div>
      </div>

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
