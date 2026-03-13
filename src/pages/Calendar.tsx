import { useState } from 'react';
import { cronJobs, DAYS_OF_WEEK, MONTHS, type CronJob } from '../data/cronJobs';

type View = 'weekly' | 'yearly';

export default function Calendar() {
  const [view, setView] = useState<View>('weekly');

  return (
    <div className="calendar-page">
      <div className="calendar-header">
        <div>
          <h2>Echo's Calendar</h2>
          <p className="subtitle">
            <span className="echo-badge">🔄 Echo</span> owns all {cronJobs.length} cron jobs
          </p>
        </div>
        <div className="view-toggle">
          <button className={view === 'weekly' ? 'active' : ''} onClick={() => setView('weekly')}>
            Weekly
          </button>
          <button className={view === 'yearly' ? 'active' : ''} onClick={() => setView('yearly')}>
            Yearly
          </button>
        </div>
      </div>

      {view === 'weekly' ? <WeeklyView /> : <YearlyView />}
    </div>
  );
}

function WeeklyView() {
  const dailyJobs = cronJobs.filter((j) => j.category === 'daily');
  const weeklyJobs = cronJobs.filter((j) => j.category === 'weekly');

  const jobsByDay: Record<number, CronJob[]> = {};
  for (let d = 0; d < 7; d++) jobsByDay[d] = [];

  weeklyJobs.forEach((job) => {
    if (job.dayOfWeek !== undefined) {
      jobsByDay[job.dayOfWeek].push(job);
    }
  });

  return (
    <div className="weekly-view">
      <div className="daily-banner">
        <h3>Every Day</h3>
        <div className="daily-jobs">
          {dailyJobs.map((job, i) => (
            <JobChip key={i} job={job} />
          ))}
        </div>
      </div>

      <div className="week-grid">
        {[1, 2, 3, 4, 5, 6, 0].map((day) => (
          <div key={day} className="day-column">
            <div className="day-header">{DAYS_OF_WEEK[day]}</div>
            <div className="day-jobs">
              {jobsByDay[day].map((job, i) => (
                <JobChip key={i} job={job} />
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

function JobChip({ job, compact = false }: { job: CronJob; compact?: boolean }) {
  const categoryColors: Record<string, string> = {
    daily: '#3b82f6',
    weekly: '#8b5cf6',
    monthly: '#f59e0b',
    yearly: '#ef4444',
    bimonthly: '#ec4899',
  };

  return (
    <div
      className={`job-chip ${compact ? 'compact' : ''}`}
      style={{ borderLeftColor: categoryColors[job.category] || '#6b7280' }}
      title={`${job.name}\n${job.schedule}\n${job.description || ''}`}
    >
      <div className="job-name">{job.name}</div>
      {!compact && job.description && <div className="job-desc">{job.description}</div>}
      <div className="job-meta">
        <span className="job-time">{job.time}</span>
        <span className="job-agent">🔄 Echo</span>
      </div>
    </div>
  );
}
