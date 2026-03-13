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
    model: 'GPT-5.4',
    preferredTier: 'GPT-5.4',
    role: 'Orchestrator',
    responsibilities: [
      'Central coordinator for all agent activities',
      'Task routing and delegation',
      'Cross-agent communication',
      'System-level decision making',
    ],
    color: '#6366f1',
    icon: '🧠',
  },
  {
    id: 'silver',
    name: 'Silver',
    model: 'Claude ACP',
    preferredTier: 'Opus 4.6',
    role: 'Coding Agent',
    responsibilities: [
      'Software engineering and development',
      'Code review and refactoring',
      'Architecture and system design',
      'Build and deployment automation',
    ],
    color: '#8b5cf6',
    icon: '⚡',
  },
  {
    id: 'geo',
    name: 'Geo',
    model: 'Claude ACP',
    preferredTier: 'Sonnet 4.6',
    role: 'Research & Writing Agent',
    responsibilities: [
      'Research and information gathering',
      'Writing and content generation',
      'Summarization and synthesis',
      'Knowledge management',
    ],
    color: '#06b6d4',
    icon: '🔍',
  },
  {
    id: 'echo',
    name: 'Echo',
    model: 'GPT-5.4',
    preferredTier: 'GPT-5.4',
    role: 'Cron & Automation Agent',
    responsibilities: [
      'All scheduled cron jobs',
      'Medical research digests (PubMed)',
      'Financial monitoring and reminders',
      'Daily briefings and summaries',
    ],
    color: '#10b981',
    icon: '🔄',
  },
];
