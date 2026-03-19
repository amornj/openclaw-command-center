export interface Agent {
  id: string;
  name: string;
  model: string;
  preferredTier: string;
  role: string;
  responsibilities: string[];
  color: string;
  icon: string;
}

export const agents: Agent[] = [
  {
    id: 'brodie',
    name: 'Brodie',
    model: 'Anthropic',
    preferredTier: 'Claude Opus 4.6 → GPT-5.4',
    role: 'Orchestrator',
    responsibilities: [
      'Central coordinator for all agent activities',
      'Task routing and delegation',
      'Cross-agent communication',
      'System-level decision making',
      'Fallback to GPT-5.4 on rate limit',
    ],
    color: '#6366f1',
    icon: '🐕',
  },
  {
    id: 'silver',
    name: 'Silver',
    model: 'Claude ACP',
    preferredTier: 'Sonnet 4.6',
    role: '1st Coder',
    responsibilities: [
      'Primary coding and development',
      'Architecture and system design',
      'Code review and refactoring',
      'Build and deployment automation',
    ],
    color: '#8b5cf6',
    icon: '⚡',
  },
  {
    id: 'geo',
    name: 'Geo',
    model: 'OpenAI ACP',
    preferredTier: 'GPT-5.4',
    role: '2nd Coder',
    responsibilities: [
      'Secondary coding and development',
      'Feature implementation',
      'Bug fixes and debugging',
      'Code optimization',
    ],
    color: '#06b6d4',
    icon: '🌐',
  },
  {
    id: 'echo',
    name: 'Echo',
    model: 'Gemini ACP',
    preferredTier: 'gemini-3.1-pro-preview',
    role: 'Cron & 3rd Coder',
    responsibilities: [
      'All scheduled cron jobs',
      'Medical research digests (PubMed)',
      'Financial monitoring and reminders',
      'Daily briefings and summaries',
      'Tertiary coding agent',
    ],
    color: '#10b981',
    icon: '🔄',
  },
  {
    id: 'harvey',
    name: 'Harvey',
    model: 'MiniMax ACP',
    preferredTier: 'MiniMax-M2.7',
    role: '4th Coder',
    responsibilities: [
      'Quaternary coding agent',
      'Code review and PR feedback',
      'Documentation generation',
      'Build and deploy automation',
    ],
    color: '#f59e0b',
    icon: '⚔️',
  },
  {
    id: 'hunter',
    name: 'Hunter',
    model: 'Gemini ACP',
    preferredTier: 'gemini-3.1-flash-lite',
    role: 'Reader Triage & Clinical Radar',
    responsibilities: [
      'Morning clinical radar',
      'Evening Reader inbox triage',
      'Nightly learning recap',
      'Low-cost knowledge surfacing',
    ],
    color: '#ec4899',
    icon: '🎯',
  },
  {
    id: 'shin',
    name: 'Shin',
    model: 'OpenAI ACP',
    preferredTier: 'gpt-5.4-mini',
    role: 'Cron Watchdog & Heartbeat',
    responsibilities: [
      'Gateway health monitoring',
      'Cron failure detection',
      'Heartbeat state tracking',
      'Lightweight ops watchdog',
    ],
    color: '#64748b',
    icon: '🌙',
  },
];
