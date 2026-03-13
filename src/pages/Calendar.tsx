import { useState, useEffect } from 'react';
import { cronJobs, DAYS_OF_WEEK, MONTHS, type CronJob } from '../data/cronJobs';
import { fetchCronStatuses, type CronJobStatus } from '../data/cronStatus';

type View = 'daily' | 'weekly' | 'monthly' | 'yearly';

export default function Calendar() {
  const [view, setView] = useState<View>('daily');
  const [statuses, setStatuses] = useState<CronJobStatus[]>([]);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    load();
    const interval = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(interval); };

    async function load() {
      const data = await fetchCronStatuses();
      if (cancelled) return;
      setStatuses(data);
      setIsLive(data.some((s) => s.message !== null));
    }
  }, []);

  const statusMap = new Map(statuses.map((s) => [s.job.name, s]));

  return (
    <div className="calendar-page">
      <div className="calendar-header">
        <div>
          <h2>Echo's Calendar</h2>
          <p className="subtitle">
            <span className="echo-badge">🔄 Echo</span> owns all {cronJobs.length} cron jobs
            {statuses.length > 0 && (
              <span className={`source-badge ${isLive ? 'live' : 'derived'}`} style={{ marginLeft: 10 }}>
                {isLive ? '● Live' : '○ Derived'}
              </span>
            )}
          </p>
        </div>
        <div className="view-toggle">
          {(['daily', 'weekly', 'monthly', 'yearly'] as View[]).map((v) => (
            <button key={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {view === 'daily' && <DailyView statusMap={statusMap} />}
      {view === 'weekly' && <WeeklyView statusMap={statusMap} />}
      {view === 'monthly' && <MonthlyView statusMap={statusMap} />}
      {view === 'yearly' && <YearlyView />}
    </div>
  );
}

/* ── Daily View: Today's schedule as a timeline ── */
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

/* ── Weekly View ── */
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

/* ── Monthly View: Calendar grid for current month ── */
function MonthlyView({ statusMap }: { statusMap: Map<string, CronJobStatus> }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const today = now.getDate();

  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Build job map by day of month
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

  // Calendar grid cells
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

/* ── Yearly View ── */
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
