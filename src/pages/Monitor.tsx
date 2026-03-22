import { useEffect, useState, useRef, useCallback } from 'react';
import { trackPageView } from '../data/sessionUsage';
import {
  fetchMonitorMessages,
  filterEntries,
  formatTime,
  agentColors,
  clearBuffer,
  type MonitorEntry,
  type MonitorFilter,
} from '../data/monitorData';

/** Available poll intervals */
const POLL_OPTIONS = [2, 5, 10, 30] as const;
const AGENTS = ['all', 'sonnet-4.6', 'opus-4.6', 'gpt-5.4', 'gemini-3.1-pro', 'minimax-m2.7', 'gemini-3.1-flash-lite', 'gpt-5.4-mini'];

/** Reverse map: model label → agent id (for filtering) */
const MODEL_TO_AGENT: Record<string, string> = {
  'sonnet-4.6': 'Silver',
  'opus-4.6': 'Brodie',
  'gpt-5.4': 'Geo',
  'gemini-3.1-pro': 'Echo',
  'minimax-m2.7': 'Harvey',
  'gemini-3.1-flash-lite': 'Hunter',
  'gpt-5.4-mini': 'Shin',
};
const DIRECTIONS = ['all', 'received', 'sent'] as const;

/** Source label for display */
const SOURCE_LABELS: Record<string, string> = {
  'claude-session': 'Claude',
  'openclaw-main': 'OpenClaw',
  'cron-run': 'Cron',
};

/** Agent name → display model name for the Monitor column */
const AGENT_MODEL_LABELS: Record<string, string> = {
  Brodie:   'opus-4.6',
  Silver:   'sonnet-4.6',
  Geo:      'gpt-5.4',
  Echo:     'gemini-3.1-pro',
  Harvey:   'minimax-m2.7',
  Hunter:   'gemini-3.1-flash-lite',
  Shin:     'gpt-5.4-mini',
};

export default function Monitor() {
  useEffect(() => { trackPageView('Monitor'); }, []);

  const [entries, setEntries] = useState<MonitorEntry[]>([]);
  const [filter, setFilter] = useState<MonitorFilter>({ agent: 'all', direction: 'all' });
  const [maxAge, setMaxAge] = useState(60);
  const [isLive, setIsLive] = useState(true);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [hasData, setHasData] = useState<boolean | null>(null);
  const [pollInterval, setPollInterval] = useState<typeof POLL_OPTIONS[number]>(5);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [fetchCount, setFetchCount] = useState(0);

  const logRef = useRef<HTMLDivElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Pull-to-refresh state
  const touchStartYRef = useRef(0);
  const [pullY, setPullY] = useState(0);
  const PULL_THRESHOLD = 64;

  // Use refs for the polling loop so interval changes take effect immediately
  const pollIntervalRef = useRef(pollInterval);
  const isLiveRef = useRef(isLive);
  const maxAgeRef = useRef(maxAge);
  pollIntervalRef.current = pollInterval;
  isLiveRef.current = isLive;
  maxAgeRef.current = maxAge;

  const handleScroll = useCallback(() => {
    const el = logRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setShowScrollBtn(!atBottom);
    if (atBottom) setAutoScroll(true);
  }, []);

  const scrollToBottom = useCallback(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setAutoScroll(true);
    setShowScrollBtn(false);
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const el = logRef.current;
    if (el && el.scrollTop === 0) {
      touchStartYRef.current = e.touches[0].clientY;
    } else {
      touchStartYRef.current = 0;
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    if (pullY >= PULL_THRESHOLD) {
      doFetch();
    }
    setPullY(0);
    touchStartYRef.current = 0;
  }, [pullY, doFetch]);

  // Non-passive touchmove so we can preventDefault and block native scroll while pulling
  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    const handleTouchMove = (e: TouchEvent) => {
      if (!touchStartYRef.current) return;
      const delta = e.touches[0].clientY - touchStartYRef.current;
      if (delta > 0) {
        e.preventDefault();
        setPullY(Math.min(delta, PULL_THRESHOLD * 1.5));
      }
    };
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', handleTouchMove);
  }, []);

  // Core fetch function — always uses latest refs
  const doFetch = useCallback(async () => {
    setIsRefreshing(true);
    // Scale limit with time range so older agent entries aren't cut off
    const limit = maxAgeRef.current > 60 ? 500 : 200;
    const data = await fetchMonitorMessages(maxAgeRef.current, limit);
    setEntries([...data]);
    setHasData(data.length > 0);
    setLastFetch(new Date());
    setFetchCount((c) => c + 1);
    setIsRefreshing(false);
  }, []);

  // Polling loop: re-schedules itself with current interval from ref
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      await doFetch();
      if (cancelled || !isLiveRef.current) return;
      timer = setTimeout(tick, pollIntervalRef.current * 1000);
    };

    tick();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  // Restart the loop when live/paused toggles, time range changes, or poll rate changes
  }, [isLive, maxAge, pollInterval, doFetch]);

  // Auto-scroll on new entries
  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [entries, autoScroll]);

  // Clear buffer when time range changes
  useEffect(() => { clearBuffer(); }, [maxAge]);

  // Convert model label back to agent name for filtering
  const filterForEntries = {
    ...filter,
    agent: filter.agent === 'all' ? 'all' : (MODEL_TO_AGENT[filter.agent || ''] || 'all'),
  };
  const filtered = filterEntries(entries, filterForEntries);

  // Group entries by session for visual separators
  let lastSession = '';

  const toggleExpand = (key: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Compute agent counts for the status bar
  const agentCounts = new Map<string, number>();
  for (const e of entries) {
    agentCounts.set(e.agent, (agentCounts.get(e.agent) || 0) + 1);
  }

  return (
    <div className="monitor-page">
      <div className="monitor-header">
        <div>
          <h2>Monitor</h2>
          <p className="subtitle">Agent Activity Log</p>
        </div>
        <div className="monitor-controls">
          <div className="monitor-filters">
            <select
              value={filter.agent || 'all'}
              onChange={(e) => setFilter((f) => ({ ...f, agent: e.target.value }))}
              className="monitor-select"
            >
              <option value="all">All Models</option>
              {AGENTS.filter((a) => a !== 'all').map((model) => {
                const agent = MODEL_TO_AGENT[model];
                const count = agentCounts.get(agent) || 0;
                return (
                  <option key={model} value={model}>
                    {agent} · {model} ({count})
                  </option>
                );
              })}
            </select>
            <select
              value={filter.direction || 'all'}
              onChange={(e) => setFilter((f) => ({ ...f, direction: e.target.value as typeof DIRECTIONS[number] }))}
              className="monitor-select"
            >
              <option value="all">All Types</option>
              <option value="received">Received</option>
              <option value="sent">Sent</option>
            </select>
            <select
              value={maxAge}
              onChange={(e) => setMaxAge(parseInt(e.target.value, 10))}
              className="monitor-select"
            >
              <option value={15}>Last 15m</option>
              <option value={60}>Last 1h</option>
              <option value={360}>Last 6h</option>
              <option value={1440}>Last 24h</option>
            </select>
            <input
              type="text"
              placeholder="Search agent, project, content…"
              className="monitor-search"
              value={filter.search || ''}
              onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
            />
          </div>
          <div className="monitor-status">
            <button
              className="monitor-sync-btn"
              onClick={doFetch}
              disabled={isRefreshing}
              title="Force sync"
            >
              {isRefreshing ? '↻' : '⟳'} Sync
            </button>
            <button
              className={`monitor-live-btn ${isLive ? 'active' : ''}`}
              onClick={() => setIsLive(!isLive)}
            >
              {isLive ? '● Live' : '○ Paused'}
            </button>
            <select
              value={pollInterval}
              onChange={(e) => setPollInterval(Number(e.target.value) as typeof POLL_OPTIONS[number])}
              className="monitor-select monitor-poll-select"
              title="Poll interval"
            >
              {POLL_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}s</option>
              ))}
            </select>
            <label className="monitor-autoscroll">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
              />
              Auto-scroll
            </label>
            {lastFetch && (
              <span className="monitor-last-fetch" key={fetchCount}>
                {isRefreshing ? 'Refreshing…' : lastFetch.toLocaleTimeString()}
              </span>
            )}
            <span className={`activity-source-badge ${hasData ? 'live' : ''}`}>
              {hasData ? '● Live Data' : '○ No Data'}
            </span>
          </div>
        </div>
      </div>

      <div
        className="monitor-log"
        ref={logRef}
        onScroll={handleScroll}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {pullY > 0 && (
          <div className="monitor-pull-indicator" style={{ height: pullY }}>
            <span style={{ opacity: pullY / PULL_THRESHOLD }}>
              {pullY >= PULL_THRESHOLD ? '↑ Release to sync' : '↓ Pull to sync'}
            </span>
          </div>
        )}
        {hasData === false && (
          <div className="monitor-empty">
            <p>No agent messages found in the selected time range.</p>
            <p className="monitor-empty-hint">
              Messages appear when agents run sessions locally.
            </p>
            <p className="monitor-empty-hint">
              Sources: Claude sessions, OpenClaw main, Cron runs
            </p>
          </div>
        )}
        {filtered.length === 0 && hasData && (
          <div className="monitor-empty">
            <p>No messages match the current filters.</p>
            <p className="monitor-empty-hint">
              Try widening your search or changing the time range.
            </p>
          </div>
        )}
        {filtered.map((entry, i) => {
          const key = `${entry.timestamp}-${entry.sessionId}-${i}`;
          const isExpanded = expandedRows.has(key);
          const showSessionSep = entry.sessionId !== lastSession && lastSession !== '';
          lastSession = entry.sessionId;

          return (
            <div key={key}>
              {showSessionSep && <div className="monitor-session-sep" />}
              <LogRow
                entry={entry}
                isExpanded={isExpanded}
                onToggle={() => entry.truncated && toggleExpand(key)}
              />
            </div>
          );
        })}
        <div ref={logEndRef} />
      </div>

      {showScrollBtn && (
        <button
          className="monitor-scroll-btn"
          onClick={scrollToBottom}
          title="Scroll to bottom"
        >
          ↓ Latest
        </button>
      )}

      <div className="monitor-footer">
        <span>{filtered.length} / {entries.length} entries</span>
        <span className="monitor-footer-agents">
          {Object.entries(AGENT_MODEL_LABELS).map(([agent, model]) => {
            const count = agentCounts.get(agent) || 0;
            return count > 0 ? (
              <span key={agent} className="monitor-footer-agent" style={{ color: agentColors[agent] }}>
                {agent} · {model}: {count}
              </span>
            ) : null;
          })}
        </span>
        <span>
          {isLive ? `Polling every ${pollInterval}s` : 'Paused'}
          {isRefreshing && ' · Refreshing…'}
          {` · #${fetchCount}`}
        </span>
      </div>
    </div>
  );
}

/** Lifecycle badge styling for Echo cron events */
const LIFECYCLE_BADGES: Record<string, { label: string; className: string }> = {
  'started': { label: 'STARTED', className: 'monitor-lifecycle-started' },
  'succeeded': { label: 'OK', className: 'monitor-lifecycle-succeeded' },
  'failed': { label: 'FAILED', className: 'monitor-lifecycle-failed' },
  'delivered': { label: 'DELIVERED', className: 'monitor-lifecycle-delivered' },
  'delivery-failed': { label: 'DLVR FAIL', className: 'monitor-lifecycle-delivery-failed' },
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

function LogRow({
  entry,
  isExpanded,
  onToggle,
}: {
  entry: MonitorEntry;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const color = agentColors[entry.agent] || '#94a3b8';
  const modelLabel = AGENT_MODEL_LABELS[entry.agent] || entry.agent;
  const dirIcon = entry.direction === 'received' ? '→'
    : entry.direction === 'sent' ? '←'
    : '◆';
  const dirLabel = entry.direction === 'received' ? 'IN'
    : entry.direction === 'sent' ? 'OUT'
    : 'SYS';

  const sourceLabel = SOURCE_LABELS[entry.source || ''] || '';
  const statusBad = entry.status === 'error';
  const lifecycle = entry.lifecycle ? LIFECYCLE_BADGES[entry.lifecycle] : null;
  const isCron = entry.source === 'cron-run';

  return (
    <div
      className={`monitor-row monitor-dir-${entry.direction} ${entry.truncated ? 'monitor-truncatable' : ''} ${isExpanded ? 'monitor-row-expanded' : ''} ${statusBad ? 'monitor-row-error' : ''} ${isCron ? 'monitor-row-cron' : ''}`}
      onClick={entry.truncated ? onToggle : undefined}
    >
      <span className="monitor-time">{formatTime(entry.timestamp)}</span>
      <span className="monitor-agent" style={{ color }} title={`Agent: ${entry.agent} · Model: ${modelLabel}`}>
        {entry.agent} · {modelLabel}
      </span>
      {lifecycle ? (
        <span className={`monitor-dir monitor-lifecycle-badge ${lifecycle.className}`}>
          {lifecycle.label}
        </span>
      ) : (
        <span className={`monitor-dir monitor-dir-badge-${entry.direction}`}>
          {dirIcon} {dirLabel}
        </span>
      )}
      {sourceLabel && (
        <span className="monitor-source">{sourceLabel}</span>
      )}
      <span className="monitor-project">{entry.project}</span>
      <span className={`monitor-content ${isExpanded ? 'monitor-content-expanded' : ''}`}>
        {entry.content}
        {entry.truncated && !isExpanded && (
          <span className="monitor-truncated-badge">…more</span>
        )}
      </span>
      {isCron && entry.durationMs != null && entry.lifecycle === 'succeeded' && (
        <span className="monitor-duration-badge">{formatDuration(entry.durationMs)}</span>
      )}
      {isCron && entry.nextRun && entry.lifecycle === 'succeeded' && (
        <span className="monitor-next-run" title={`Next: ${entry.nextRun}`}>
          ⏭ {new Date(entry.nextRun).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      )}
      {entry.status === 'error' && !lifecycle && (
        <span className="monitor-status-badge monitor-status-error">ERR</span>
      )}
      {entry.stopReason && entry.direction === 'sent' && (
        <span className="monitor-stop-reason">{entry.stopReason}</span>
      )}
    </div>
  );
}
