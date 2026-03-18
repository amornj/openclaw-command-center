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
    preferredTier: 'Claude Opus 4.6',
    role: 'Orchestrator',
    responsibilities: [
      'Central coordinator for all agent activities',
      'Task routing and delegation',
      'Cross-agent communication',
      'System-level decision making',
    ],
    color: '#6366f1',
    icon: '🐕',
  },
  {
    id: 'silver',
    name: 'Silver',
    model: 'Claude ACP',
    preferredTier: 'Sonnet 4.6',
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
    model: 'Gemini ACP',
    preferredTier: 'gemini-3.0-flash',
    role: 'Cron & Automation Agent',
    responsibilities: [
      'All scheduled cron jobs (except exercise)',
      'Medical research digests (PubMed)',
      'Financial monitoring and reminders',
      'Daily briefings and summaries',
    ],
    color: '#10b981',
    icon: '🔄',
  },
  {
    id: 'harvey',
    name: 'Harvey',
    model: 'MiniMax ACP',
    preferredTier: 'MiniMax-M2.5',
    role: 'Code Review & Secondary Coder',
    responsibilities: [
      'Code review and PR feedback',
      'Secondary coding agent (backup Silver)',
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
    preferredTier: 'gemini-3-pro-image-preview',
    role: 'Visual Engineer',
    responsibilities: [
      'Image generation and analysis',
      'Visual design tasks',
      'UI/UX visual prototyping',
      'Diagram and chart creation',
    ],
    color: '#ec4899',
    icon: '🎨',
  },
];
