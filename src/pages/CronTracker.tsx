import { useState, useEffect } from 'react';
import { fetchCronStatuses, type CronJobStatus, type CronStatus } from '../data/cronStatus';
import { trackPageView, trackRefreshPoll } from '../data/sessionUsage';

const STATUS_CONFIG: Record<CronStatus, { color: string; bg: string; icon: string }> = {
  Scheduled:  { color: '#94a3b8', bg: '#1e293b', icon: '◷' },
  Running:    { color: '#38bdf8', bg: '#0c4a6e', icon: '⟳' },
  Succeeded:  { color: '#4ade80', bg: '#14532d', icon: '✓' },
  Failed:     { color: '#f87171', bg: '#7f1d1d', icon: '✕' },
  Partial:    { color: '#fbbf24', bg: '#713f12', icon: '⚠' },
  Disabled:   { color: '#64748b', bg: '#1e293b', icon: '⏸' },
  Unknown:    { color: '#6b7280', bg: '#1f2937', icon: '?' },
};

const ALL_STATUSES: CronStatus[] = ['Scheduled', 'Running', 'Succeeded', 'Failed', 'Partial', 'Disabled', 'Unknown'];

export default function CronTracker() {
  const [jobs, setJobs] = useState<CronJobStatus[]>([]);
  const [filter, setFilter] = useState<CronStatus | 'All'>('All');
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    trackPageView('Cron Tracker');
    let cancelled = false;
    loadStatuses();

    // Refresh every 30s
    const interval = setInterval(() => { trackRefreshPoll('Cron Tracker'); loadStatuses(); }, 30_000);
    return () => { cancelled = true; clearInterval(interval); };

    async function loadStatuses() {
      const statuses = await fetchCronStatuses();
      if (cancelled) return;
      setJobs(statuses);
      setLoading(false);

      // Detect if backend responded (any job has a non-null message = live)
      setIsLive(statuses.some((s) => s.message !== null));
    }
  }, []);

  const counts = countByStatus(jobs);
  const filtered = filter === 'All' ? jobs : jobs.filter((j) => j.status === filter);

  return (
    <div className="cron-tracker-page">
      <div className="cron-tracker-header">
        <div>
          <h2>Cron Tracker</h2>
          <p className="subtitle">
            {jobs.length} jobs monitored
            <span className={`source-badge ${isLive ? 'live' : 'derived'}`}>
              {isLive ? '● Live' : '○ Schedule-derived'}
            </span>
          </p>
        </div>
      </div>

      {/* Status summary cards */}
      <div className="status-summary">
        <button
          className={`summary-card ${filter === 'All' ? 'active' : ''}`}
          onClick={() => setFilter('All')}
        >
          <span className="summary-count">{jobs.length}</span>
          <span className="summary-label">All</span>
        </button>
        {ALL_STATUSES.map((s) => {
          const c = counts[s] || 0;
          if (c === 0) return null;
          const cfg = STATUS_CONFIG[s];
          return (
            <button
              key={s}
              className={`summary-card ${filter === s ? 'active' : ''}`}
              onClick={() => setFilter(filter === s ? 'All' : s)}
              style={{ '--status-color': cfg.color } as React.CSSProperties}
            >
              <span className="summary-count" style={{ color: cfg.color }}>{c}</span>
              <span className="summary-label">{s}</span>
            </button>
          );
        })}
      </div>

      {/* Job table */}
      {loading ? (
        <div className="cron-loading">Loading…</div>
      ) : (
        <div className="cron-table-wrap">
          <table className="cron-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Job</th>
                <th>Schedule</th>
                <th>Last Run</th>
                <th>Next Run</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry, i) => {
                const cfg = STATUS_CONFIG[entry.status];
                return (
                  <tr key={i}>
                    <td>
                      <span className="status-pill" style={{ background: cfg.bg, color: cfg.color }}>
                        <span className="status-icon">{cfg.icon}</span>
                        {entry.status}
                      </span>
                    </td>
                    <td>
                      <div className="cron-job-name">{entry.job.name}</div>
                      {entry.job.description && (
                        <div className="cron-job-desc">{entry.job.description}</div>
                      )}
                    </td>
                    <td className="cron-mono">{entry.job.schedule}</td>
                    <td className="cron-mono">{formatTime(entry.lastRun)}</td>
                    <td className="cron-mono">{formatTime(entry.nextRun)}</td>
                    <td className="cron-mono">{entry.duration ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function countByStatus(jobs: CronJobStatus[]): Partial<Record<CronStatus, number>> {
  const map: Partial<Record<CronStatus, number>> = {};
  for (const j of jobs) {
    map[j.status] = (map[j.status] || 0) + 1;
  }
  return map;
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Today ${time}`;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
}
