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

/** Available poll intervals (inspired by clawmonitor's `f` key cycling) */
const POLL_OPTIONS = [2, 5, 10, 30] as const;
const AGENTS = ['all', 'Silver', 'Brodie', 'Geo', 'Echo'];
const DIRECTIONS = ['all', 'received', 'sent'] as const;

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

  const logRef = useRef<HTMLDivElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Track whether user has scrolled away from bottom
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

  const load = useCallback(async () => {
    setIsRefreshing(true);
    const data = await fetchMonitorMessages(maxAge, 200);
    setEntries([...data]); // new array ref to trigger render
    setHasData(data.length > 0);
    setLastFetch(new Date());
    setIsRefreshing(false);
  }, [maxAge]);

  // Polling loop
  useEffect(() => {
    load();
    if (!isLive) return;
    const interval = setInterval(load, pollInterval * 1000);
    return () => clearInterval(interval);
  }, [isLive, maxAge, pollInterval, load]);

  // Auto-scroll on new entries
  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [entries, autoScroll]);

  // Clear buffer when time range changes
  useEffect(() => {
    clearBuffer();
  }, [maxAge]);

  const filtered = filterEntries(entries, filter);

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

  return (
    <div className="monitor-page">
      <div className="monitor-header">
        <div>
          <h2>Monitor</h2>
          <p className="subtitle">Agent Message Activity Log</p>
        </div>
        <div className="monitor-controls">
          <div className="monitor-filters">
            <select
              value={filter.agent || 'all'}
              onChange={(e) => setFilter((f) => ({ ...f, agent: e.target.value }))}
              className="monitor-select"
            >
              {AGENTS.map((a) => (
                <option key={a} value={a}>{a === 'all' ? 'All Agents' : a}</option>
              ))}
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
              <span className="monitor-last-fetch">
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
      >
        {hasData === false && (
          <div className="monitor-empty">
            <p>No agent messages found in the selected time range.</p>
            <p className="monitor-empty-hint">
              Messages appear when Claude agents run sessions locally.
            </p>
            <p className="monitor-empty-hint">
              Source: ~/.claude/projects/*/&#8203;*.jsonl
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
          // Session separator: show when session changes
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
        <span>
          {isLive ? `Polling every ${pollInterval}s` : 'Paused'}
          {isRefreshing && ' · Refreshing…'}
        </span>
      </div>
    </div>
  );
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
  const dirIcon = entry.direction === 'received' ? '→' : '←';
  const dirLabel = entry.direction === 'received' ? 'IN' : 'OUT';

  return (
    <div
      className={`monitor-row monitor-dir-${entry.direction} ${entry.truncated ? 'monitor-truncatable' : ''} ${isExpanded ? 'monitor-row-expanded' : ''}`}
      onClick={entry.truncated ? onToggle : undefined}
    >
      <span className="monitor-time">{formatTime(entry.timestamp)}</span>
      <span className="monitor-agent" style={{ color }}>
        {entry.agent}
      </span>
      <span className={`monitor-dir monitor-dir-badge-${entry.direction}`}>
        {dirIcon} {dirLabel}
      </span>
      <span className="monitor-project">{entry.project}</span>
      <span className={`monitor-content ${isExpanded ? 'monitor-content-expanded' : ''}`}>
        {entry.content}
        {entry.truncated && !isExpanded && (
          <span className="monitor-truncated-badge">…more</span>
        )}
      </span>
      {entry.stopReason && entry.direction === 'sent' && (
        <span className="monitor-stop-reason">{entry.stopReason}</span>
      )}
    </div>
  );
}
