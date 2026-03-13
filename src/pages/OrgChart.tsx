import { agents } from '../data/orgChart';

export default function OrgChart() {
  const brodie = agents.find((a) => a.id === 'brodie')!;
  const others = agents.filter((a) => a.id !== 'brodie');

  return (
    <div className="org-chart">
      <h2>Organization Chart</h2>
      <p className="subtitle">OpenClaw Agent Hierarchy</p>

      <div className="org-tree">
        <div className="org-leader">
          <AgentCard agent={brodie} isLeader />
        </div>
        <div className="org-connector">
          <div className="org-line-down" />
          <div className="org-line-horizontal" />
        </div>
        <div className="org-members">
          {others.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      </div>
    </div>
  );
}

function AgentCard({ agent, isLeader = false }: { agent: (typeof agents)[0]; isLeader?: boolean }) {
  return (
    <div
      className={`agent-card ${isLeader ? 'leader' : ''}`}
      style={{ '--agent-color': agent.color } as React.CSSProperties}
    >
      <div className="agent-header">
        <span className="agent-icon">{agent.icon}</span>
        <div>
          <h3>{agent.name}</h3>
          <span className="agent-role">{agent.role}</span>
        </div>
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
