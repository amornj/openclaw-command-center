import { useEffect, useState, useRef } from 'react';
import { trackPageView } from '../data/sessionUsage';
import {
  fetchMonitorMessages,
  filterEntries,
  formatTime,
  agentColors,
  type MonitorEntry,
  type MonitorFilter,
} from '../data/monitorData';

const POLL_INTERVAL = 5_000;
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
  const logEndRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const load = async () => {
    const data = await fetchMonitorMessages(maxAge, 200);
    setEntries(data);
    setHasData(data.length > 0);
    setLastFetch(new Date());
  };

  useEffect(() => {
    load();
    if (!isLive) return;
    const interval = setInterval(load, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [isLive, maxAge]);

  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [entries, autoScroll]);

  const filtered = filterEntries(entries, filter);

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
              placeholder="Search…"
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
                {lastFetch.toLocaleTimeString()}
              </span>
            )}
            <span className="activity-source-badge live">
              {hasData ? '● Live Data' : '○ No Data'}
            </span>
          </div>
        </div>
      </div>

      <div className="monitor-log">
        {hasData === false && (
          <div className="monitor-empty">
            <p>No agent messages found in the selected time range.</p>
            <p className="monitor-empty-hint">
              Messages appear here when Claude agents are active in local sessions.
            </p>
          </div>
        )}
        {filtered.length === 0 && hasData && (
          <div className="monitor-empty">
            <p>No messages match the current filters.</p>
          </div>
        )}
        {filtered.map((entry, i) => (
          <LogRow key={`${entry.timestamp}-${i}`} entry={entry} />
        ))}
        <div ref={logEndRef} />
      </div>

      <div className="monitor-footer">
        <span>{filtered.length} / {entries.length} entries</span>
        <span>Polling every {POLL_INTERVAL / 1000}s</span>
      </div>
    </div>
  );
}

function LogRow({ entry }: { entry: MonitorEntry }) {
  const color = agentColors[entry.agent] || '#94a3b8';
  const dirIcon = entry.direction === 'received' ? '→' : '←';
  const dirLabel = entry.direction === 'received' ? 'IN' : 'OUT';

  return (
    <div className={`monitor-row monitor-dir-${entry.direction}`}>
      <span className="monitor-time">{formatTime(entry.timestamp)}</span>
      <span className="monitor-agent" style={{ color }}>
        {entry.agent}
      </span>
      <span className={`monitor-dir monitor-dir-badge-${entry.direction}`}>
        {dirIcon} {dirLabel}
      </span>
      <span className="monitor-project">{entry.project}</span>
      <span className="monitor-content">{entry.content}</span>
    </div>
  );
}
