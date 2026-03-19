import { useState, useEffect } from 'react';
import { fetchCronStatuses, type CronJobStatus, type CronStatus } from '../data/cronStatus';
import { cronJobs, DAYS_OF_WEEK, MONTHS, type CronJob } from '../data/cronJobs';
import { trackPageView, trackRefreshPoll } from '../data/sessionUsage';

type Tab = 'list' | 'daily' | 'weekly' | 'monthly' | 'yearly';

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
const TABS: { key: Tab; label: string }[] = [
  { key: 'list', label: 'List' },
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly', label: 'Yearly' },
];

export default function CronTracker() {
  const [jobs, setJobs] = useState<CronJobStatus[]>([]);
  const [filter, setFilter] = useState<CronStatus | 'All'>('All');
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [tab, setTab] = useState<Tab>('list');
  const [runningJobId, setRunningJobId] = useState<string | null>(null);

  const loadStatuses = async (cancelled = false) => {
    const statuses = await fetchCronStatuses();
    if (cancelled) return;
    setJobs(statuses);
    setLoading(false);
    setIsLive(statuses.some((s) => s.message !== null || !!s.id));
  };

  useEffect(() => {
    trackPageView('Cron Tracker');
    let cancelled = false;
    loadStatuses();

    const interval = setInterval(() => { trackRefreshPoll('Cron Tracker'); loadStatuses(cancelled); }, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const counts = countByStatus(jobs);
  const filtered = filter === 'All' ? jobs : jobs.filter((j) => j.status === filter);
  const statusMap = new Map(jobs.map((s) => [s.job.name, s]));

  const handleRunNow = async (entry: CronJobStatus) => {
    if (!entry.id || runningJobId) return;
    setRunningJobId(entry.id);
    try {
      const res = await fetch('/api/cron/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entry.id }),
      });
      if (!res.ok) throw new Error(`Run failed (${res.status})`);
      await loadStatuses();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to run cron job');
    } finally {
      setRunningJobId(null);
    }
  };

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

      {/* Tab bar */}
      <div className="cron-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`cron-tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'list' && (
        <>
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
                    <th>Agent</th>
                    <th>Actions</th>
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
                        <td>{entry.job.agent}</td>
                        <td>
                          <button
                            className="refresh-btn"
                            disabled={!entry.id || runningJobId === entry.id}
                            onClick={() => handleRunNow(entry)}
                            title={entry.id ? 'Run this cron job now' : 'Run-now not available for schedule-derived jobs'}
                          >
                            {runningJobId === entry.id ? 'Running…' : 'Run now'}
                          </button>
                          {typeof entry.consecutiveErrors === 'number' && entry.consecutiveErrors > 0 && (
                            <div className="cron-job-desc" style={{ marginTop: 6, color: '#fca5a5' }}>
                              {entry.consecutiveErrors} consecutive error{entry.consecutiveErrors > 1 ? 's' : ''}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'daily' && <DailyView statusMap={statusMap} />}
      {tab === 'weekly' && <WeeklyView statusMap={statusMap} />}
      {tab === 'monthly' && <MonthlyView statusMap={statusMap} />}
      {tab === 'yearly' && <YearlyView />}
    </div>
  );
}

/* ── Calendar Views (merged from Calendar page) ── */

function DailyView({ statusMap }: { statusMap: Map<string, CronJobStatus> }) {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const dayOfMonth = now.getDate();
  const month = now.getMonth() + 1;

  const todaysJobs = cronJobs.filter((job) => {
    if (job.category === 'daily') return true;
    if (job.category === 'weekly' && job.dayOfWeek === dayOfWeek) return true;
    if (job.category === 'monthly' && job.dayOfMonth === dayOfMonth) return true;
    if ((job.category === 'yearly' || job.category === 'bimonthly') && job.months?.includes(month) && job.dayOfMonth === dayOfMonth) return true;
    return false;
  });

  todaysJobs.sort((a, b) => a.time.localeCompare(b.time));

  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="daily-view">
      <div className="daily-date-header">
        <h3>{dateStr}</h3>
        <span className="daily-count">{todaysJobs.length} jobs today</span>
      </div>
      <div className="timeline">
        {todaysJobs.length === 0 ? (
          <div className="no-jobs-today">No jobs scheduled for today</div>
        ) : (
          todaysJobs.map((job, i) => {
            const status = statusMap.get(job.name);
            return <TimelineItem key={i} job={job} status={status} />;
          })
        )}
      </div>
    </div>
  );
}

function TimelineItem({ job, status }: { job: CronJob; status?: CronJobStatus }) {
  const categoryColors: Record<string, string> = {
    daily: '#3b82f6', weekly: '#8b5cf6', monthly: '#f59e0b', yearly: '#ef4444', bimonthly: '#ec4899',
  };

  const statusColors: Record<string, { color: string; icon: string }> = {
    Scheduled: { color: '#94a3b8', icon: '◷' },
    Running: { color: '#38bdf8', icon: '⟳' },
    Succeeded: { color: '#4ade80', icon: '✓' },
    Failed: { color: '#f87171', icon: '✕' },
    Partial: { color: '#fbbf24', icon: '⚠' },
  };
  const sc = status ? statusColors[status.status] : null;

  return (
    <div className="timeline-item">
      <div className="timeline-time">{job.time}</div>
      <div className="timeline-dot" style={{ borderColor: categoryColors[job.category] || '#6b7280' }} />
      <div className="timeline-content" style={{ borderLeftColor: categoryColors[job.category] || '#6b7280' }}>
        <div className="timeline-name">
          {job.name}
          {sc && (
            <span className="timeline-status" style={{ color: sc.color }}>{sc.icon} {status!.status}</span>
          )}
        </div>
        {job.description && <div className="timeline-desc">{job.description}</div>}
        <div className="timeline-meta">
          <span className="job-cat-badge" style={{ color: categoryColors[job.category] }}>{job.category}</span>
          {status?.duration && <span className="timeline-duration">{status.duration}</span>}
        </div>
      </div>
    </div>
  );
}

function WeeklyView({ statusMap }: { statusMap: Map<string, CronJobStatus> }) {
  const dailyJobs = cronJobs.filter((j) => j.category === 'daily');
  const weeklyJobs = cronJobs.filter((j) => j.category === 'weekly');

  const jobsByDay: Record<number, CronJob[]> = {};
  for (let d = 0; d < 7; d++) jobsByDay[d] = [];

  weeklyJobs.forEach((job) => {
    if (job.dayOfWeek !== undefined) {
      jobsByDay[job.dayOfWeek].push(job);
    }
  });

  const today = new Date().getDay();

  return (
    <div className="weekly-view">
      <div className="daily-banner">
        <h3>Every Day</h3>
        <div className="daily-jobs">
          {dailyJobs.map((job, i) => (
            <JobChip key={i} job={job} status={statusMap.get(job.name)} />
          ))}
        </div>
      </div>

      <div className="week-grid">
        {[1, 2, 3, 4, 5, 6, 0].map((day) => (
          <div key={day} className={`day-column ${day === today ? 'today' : ''}`}>
            <div className="day-header">
              {DAYS_OF_WEEK[day]}
              {day === today && <span className="today-dot">●</span>}
            </div>
            <div className="day-jobs">
              {jobsByDay[day].map((job, i) => (
                <JobChip key={i} job={job} status={statusMap.get(job.name)} />
              ))}
              {jobsByDay[day].length === 0 && (
                <span className="no-jobs">No weekly-specific jobs</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthlyView({ statusMap }: { statusMap: Map<string, CronJobStatus> }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const jobsByDay: Record<number, CronJob[]> = {};
  for (let d = 1; d <= daysInMonth; d++) {
    jobsByDay[d] = [];
    const dayDate = new Date(year, month, d);
    const dow = dayDate.getDay();
    const m = month + 1;

    cronJobs.forEach((job) => {
      if (job.category === 'daily') {
        jobsByDay[d].push(job);
      } else if (job.category === 'weekly' && job.dayOfWeek === dow) {
        jobsByDay[d].push(job);
      } else if (job.category === 'monthly' && job.dayOfMonth === d) {
        jobsByDay[d].push(job);
      } else if ((job.category === 'yearly' || job.category === 'bimonthly') && job.months?.includes(m) && job.dayOfMonth === d) {
        jobsByDay[d].push(job);
      }
    });
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="monthly-view">
      <h3 className="month-title">{monthName}</h3>
      <div className="month-calendar-grid">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="mcal-header">{d}</div>
        ))}
        {cells.map((day, i) => (
          <div key={i} className={`mcal-cell ${day === today ? 'mcal-today' : ''} ${day === null ? 'mcal-empty' : ''}`}>
            {day !== null && (
              <>
                <div className="mcal-day-num">{day}</div>
                <div className="mcal-jobs">
                  {jobsByDay[day].slice(0, 4).map((job, j) => {
                    const status = statusMap.get(job.name);
                    return (
                      <div
                        key={j}
                        className="mcal-job-dot"
                        title={`${job.name} (${job.time}) ${status?.status ?? ''}`}
                        style={{ background: getCategoryColor(job.category), opacity: status?.status === 'Succeeded' ? 0.5 : 1 }}
                      />
                    );
                  })}
                  {jobsByDay[day].length > 4 && (
                    <span className="mcal-more">+{jobsByDay[day].length - 4}</span>
                  )}
                </div>
                {jobsByDay[day].length > 0 && (
                  <div className="mcal-job-list">
                    {jobsByDay[day].filter(j => j.category !== 'daily').map((job, j) => (
                      <div key={j} className="mcal-job-name" style={{ color: getCategoryColor(job.category) }}>
                        {job.name}
                      </div>
                    ))}
                    {jobsByDay[day].some(j => j.category === 'daily') && (
                      <div className="mcal-job-name" style={{ color: '#475569' }}>
                        +{jobsByDay[day].filter(j => j.category === 'daily').length} daily
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function YearlyView() {
  const monthlyJobs = cronJobs.filter((j) => j.category === 'monthly');
  const yearlyJobs = cronJobs.filter((j) => j.category === 'yearly' || j.category === 'bimonthly');

  return (
    <div className="yearly-view">
      <div className="monthly-banner">
        <h3>Every Month</h3>
        <div className="monthly-jobs">
          {monthlyJobs.map((job, i) => (
            <JobChip key={i} job={job} compact />
          ))}
        </div>
      </div>

      <div className="year-grid">
        {MONTHS.map((monthName, idx) => {
          const month = idx + 1;
          const specific = yearlyJobs.filter((j) => j.months?.includes(month));
          return (
            <div key={month} className="month-cell">
              <div className="month-header">{monthName}</div>
              <div className="month-jobs">
                {specific.length > 0 ? (
                  specific.map((job, i) => <JobChip key={i} job={job} compact />)
                ) : (
                  <span className="no-extras">Recurring only</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Shared Components ── */

function getCategoryColor(cat: string): string {
  const colors: Record<string, string> = {
    daily: '#3b82f6', weekly: '#8b5cf6', monthly: '#f59e0b', yearly: '#ef4444', bimonthly: '#ec4899',
  };
  return colors[cat] || '#6b7280';
}

function JobChip({ job, compact = false, status }: { job: CronJob; compact?: boolean; status?: CronJobStatus }) {
  const statusIcon = status?.status === 'Succeeded' ? ' ✓' : status?.status === 'Running' ? ' ⟳' : '';

  return (
    <div
      className={`job-chip ${compact ? 'compact' : ''}`}
      style={{ borderLeftColor: getCategoryColor(job.category) }}
      title={`${job.name}\n${job.schedule}\n${job.description || ''}${status ? `\nStatus: ${status.status}` : ''}`}
    >
      <div className="job-name">{job.name}{statusIcon}</div>
      {!compact && job.description && <div className="job-desc">{job.description}</div>}
      <div className="job-meta">
        <span className="job-time">{job.time}</span>
        <span className="job-agent">🔄 Echo</span>
      </div>
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
