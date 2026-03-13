import { useEffect, useState } from 'react';
import { agents, type Agent } from '../data/orgChart';
import { trackPageView } from '../data/sessionUsage';
import {
  fetchAgentActivity,
  timeAgo,
  type AgentActivity,
  type ActivitySource,
} from '../data/agentActivity';

export default function OrgChart() {
  useEffect(() => { trackPageView('Org Chart'); }, []);
  const brodie = agents.find((a) => a.id === 'brodie')!;
  const others = agents.filter((a) => a.id !== 'brodie');

  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [dataSource, setDataSource] = useState<ActivitySource>('estimated');
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const loadActivity = async () => {
    const data = await fetchAgentActivity();
    setActivities(data);
    const hasLive = data.some((a) => a.source === 'live');
    const hasInferred = data.some((a) => a.source === 'inferred');
    setDataSource(hasLive ? 'live' : hasInferred ? 'inferred' : 'estimated');
    setLastRefreshed(new Date());
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadActivity();
    // Brief visual feedback so user sees the refresh happened
    setTimeout(() => setRefreshing(false), 400);
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!cancelled) await loadActivity();
    }
    load();
    const interval = setInterval(load, 10_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const getActivity = (id: string) => activities.find((a) => a.agentId === id);

  return (
    <div className="org-chart">
      <div className="org-chart-title-row">
        <div>
          <h2>Organization Chart</h2>
          <p className="subtitle">OpenClaw Agent Hierarchy</p>
        </div>
        <div className="org-chart-controls">
          <button
            className={`refresh-btn${refreshing ? ' refreshing' : ''}`}
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh agent activity"
          >
            <span className="refresh-icon">↻</span>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          {lastRefreshed && (
            <span className="last-refreshed">
              Updated {lastRefreshed.toLocaleTimeString()}
            </span>
          )}
          <span className={`activity-source-badge ${dataSource}`}>
            {dataSource === 'live' && '● Live'}
            {dataSource === 'inferred' && '◐ Inferred'}
            {dataSource === 'estimated' && '○ Estimated'}
          </span>
        </div>
      </div>

      <div className="org-tree">
        <div className="org-leader">
          <AgentCard agent={brodie} activity={getActivity('brodie')} isLeader />
        </div>
        <div className="org-connector">
          <div className="org-line-down" />
          <div className="org-line-horizontal" />
        </div>
        <div className="org-members">
          {others.map((agent) => (
            <AgentCard key={agent.id} agent={agent} activity={getActivity(agent.id)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function AgentCard({
  agent,
  activity,
  isLeader = false,
}: {
  agent: Agent;
  activity?: AgentActivity;
  isLeader?: boolean;
}) {
  const status = activity?.status ?? 'idle';
  const isActive = status === 'active';

  return (
    <div
      className={`agent-card ${isLeader ? 'leader' : ''} ${isActive ? 'agent-active' : ''}`}
      style={{ '--agent-color': agent.color } as React.CSSProperties}
    >
      <div className="agent-header">
        <span className="agent-icon">{agent.icon}</span>
        <div>
          <div className="agent-name-row">
            <h3>{agent.name}</h3>
            <span className={`status-dot ${status}`} title={status} />
          </div>
          <span className="agent-role">{agent.role}</span>
        </div>
      </div>

      <div className="agent-activity-section">
        {isActive && activity?.currentTask ? (
          <div className="agent-task">
            <span className="task-label">TASK</span>
            <span className="task-text">{activity.currentTask}</span>
          </div>
        ) : (
          <div className="agent-idle-info">
            <span className="idle-label">
              {status === 'standby' ? 'Standby' : 'Idle'}
            </span>
            {activity?.lastActiveAt && (
              <span className="idle-time">
                {activity.detail?.startsWith('Completed:')
                  ? activity.detail
                  : `Last active ${timeAgo(activity.lastActiveAt)}`}
              </span>
            )}
          </div>
        )}
        {activity?.detail && (
          <div className="agent-detail">
            {activity.source === 'estimated' && '⚬ '}
            {activity.detail}
          </div>
        )}
      </div>

      <div className="agent-model">
        <span className="model-badge">{agent.model}</span>
        <span className="tier-badge">{agent.preferredTier}</span>
      </div>
      <ul className="agent-responsibilities">
        {agent.responsibilities.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>
    </div>
  );
}
