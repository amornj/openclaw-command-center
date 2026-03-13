export interface Project {
  name: string;
  description: string;
  tech: string[];
  hasGit: boolean;
  category: string;
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Medical / Clinical': ['ecmo', 'hcm', 'amyloidosis', 'shock', 'cardio', 'infusion', 'pht', 'acs', 'pe2026', 'dicom', 'code-blue', 'pulmonary', 'hypertension', 'hemodynamic'],
  'AI / Agents': ['agent', 'claude', 'llm', 'mcp', 'claw', 'nanoclaw', 'nullclaw', 'openclaw', 'ottomator', 'chatterbox', 'echocraft'],
  'Tools / Utilities': ['mouse', 'annotate', 'formfill', 'timer', 'recorder', 'cron', 'skill'],
  'Learning / Research': ['learn', 'notebook', 'obsidian', 'roam', 'notion'],
};

function categorize(name: string, desc: string): string {
  const text = `${name} ${desc}`.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(k => text.includes(k))) return category;
  }
  return 'Other';
}

function inferTech(deps: string[], devDeps: string[], pyproject: boolean): string[] {
  const tech: string[] = [];
  const all = [...deps, ...devDeps];
  if (all.some(d => d.includes('next'))) tech.push('Next.js');
  else if (all.some(d => d.includes('vite'))) tech.push('Vite');
  if (all.some(d => d === 'react' || d.startsWith('@react'))) tech.push('React');
  if (all.some(d => d.includes('typescript') || d.includes('@types/'))) tech.push('TypeScript');
  if (all.some(d => d.includes('capacitor'))) tech.push('Capacitor');
  if (all.some(d => d.includes('supabase'))) tech.push('Supabase');
  if (all.some(d => d.includes('playwright') || d.includes('webdriver'))) tech.push('Automation');
  if (all.some(d => d.includes('grammy') || d.includes('telegram'))) tech.push('Telegram Bot');
  if (all.some(d => d.includes('baileys'))) tech.push('WhatsApp');
  if (all.some(d => d.includes('express'))) tech.push('Express');
  if (all.some(d => d.includes('@modelcontextprotocol'))) tech.push('MCP');
  if (pyproject) tech.push('Python');
  return tech;
}

export async function fetchProjects(): Promise<{ projects: Project[]; source: 'live' | 'seeded' }> {
  // Try live API first (served by Vite plugin in dev)
  try {
    const res = await fetch('/api/projects', { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      const data = await res.json();
      const projects: Project[] = data.map((p: any) => ({
        name: p.name,
        description: p.description || fallbackDescription(p.name),
        tech: inferTech(p.deps || [], p.devDeps || [], p.pyproject || false),
        hasGit: p.hasGit ?? false,
        category: categorize(p.name, p.description || ''),
      }));
      return { projects, source: 'live' };
    }
  } catch { /* fall through to seeded */ }

  return { projects: SEEDED_PROJECTS, source: 'seeded' };
}

function fallbackDescription(name: string): string {
  const entries: Array<[string, string]> = [
    ['annotate', 'Image annotation tool'],
    ['basicdicom', 'DICOM medical imaging viewer'],
    ['claude-mem', 'Claude persistent memory plugin'],
    ['claude-telegram', 'Claude Telegram bot integration'],
    ['code-blue-timer-export', 'Code Blue Timer export assets'],
    ['code-blue-timer-privacy-support', 'Code Blue Timer privacy & support pages'],
    ['notion', 'Notion workspace & integrations'],
    ['obsidian', 'Obsidian vault & knowledge base'],
    ['openclaw-claude-subscription', 'OpenClaw Claude subscription management'],
    ['prasison', 'Prasison agent framework experiments'],
    ['rojo', 'Rojo project workspace'],
    ['skills', 'Claude Code custom skills collection'],
    ['poodthai.zip', 'Poodthai project archive'],
  ];
  const map = new Map(entries);
  return map.get(name) || `${name} project`;
}

// Seeded from local filesystem scan — used as fallback when live API unavailable
const SEEDED_PROJECTS: Project[] = [
  { name: 'ACS2025', description: 'Acute Coronary Syndrome 2025 clinical guide app', tech: ['Next.js', 'React', 'Express'], hasGit: true, category: 'Medical / Clinical' },
  { name: 'NanoClaw', description: 'Personal Claude assistant. Lightweight, secure, customizable.', tech: ['Telegram Bot', 'WhatsApp'], hasGit: true, category: 'AI / Agents' },
  { name: 'PE2026', description: 'Pulmonary Embolism 2026 clinical guide', tech: ['Next.js', 'React'], hasGit: true, category: 'Medical / Clinical' },
  { name: 'PHT2022', description: 'Pulmonary Hypertension Clinical Guide', tech: ['Next.js', 'React', 'TypeScript'], hasGit: true, category: 'Medical / Clinical' },
  { name: 'agent-browser', description: 'Headless browser automation CLI for AI agents', tech: ['Automation'], hasGit: true, category: 'AI / Agents' },
  { name: 'amyloidosis', description: 'Cardiac Amyloidosis Clinical Guide', tech: ['Next.js', 'React', 'TypeScript'], hasGit: true, category: 'Medical / Clinical' },
  { name: 'andromeda-shock', description: 'ANDROMEDA-SHOCK 2 — CRT-PHR Algorithm', tech: ['Next.js', 'React'], hasGit: true, category: 'Medical / Clinical' },
  { name: 'annotate', description: 'Image annotation tool', tech: [], hasGit: true, category: 'Tools / Utilities' },
  { name: 'basicdicom', description: 'DICOM medical imaging viewer', tech: [], hasGit: true, category: 'Medical / Clinical' },
  { name: 'cardioflow', description: 'Hemodynamic analysis tool for left and right heart catheterization', tech: ['Capacitor', 'React'], hasGit: true, category: 'Medical / Clinical' },
  { name: 'cardioflow-ios', description: 'Cardioflow iOS companion app', tech: ['Capacitor', 'React'], hasGit: true, category: 'Medical / Clinical' },
  { name: 'chaos-arena', description: 'Chaos Arena game project', tech: ['Vite', 'React'], hasGit: true, category: 'Other' },
  { name: 'chatterbox', description: 'Open Source TTS and Voice Conversion by Resemble AI', tech: ['Python'], hasGit: true, category: 'AI / Agents' },
  { name: 'claude-figma-mcp', description: 'Claude Figma MCP — Vibe Design integration', tech: ['MCP'], hasGit: true, category: 'AI / Agents' },
  { name: 'claude-mem', description: 'Claude persistent memory plugin', tech: [], hasGit: false, category: 'AI / Agents' },
  { name: 'claude-telegram', description: 'Claude Telegram bot integration', tech: ['Telegram Bot'], hasGit: true, category: 'AI / Agents' },
  { name: 'code-blue-timer', description: 'CPR & Code Blue Timer for clinical resuscitation', tech: ['Capacitor', 'React'], hasGit: true, category: 'Medical / Clinical' },
  { name: 'code-figma', description: 'Code-Figma design-to-code tool', tech: ['React', 'TypeScript', 'Supabase'], hasGit: true, category: 'Tools / Utilities' },
  { name: 'cs-ecmo', description: 'Cardiogenic Shock & ECMO Decision Support', tech: ['Next.js', 'React'], hasGit: true, category: 'Medical / Clinical' },
  { name: 'cto-coach', description: 'CTO coaching & management tool', tech: ['React'], hasGit: true, category: 'Other' },
  { name: 'echocraft-ai', description: 'EchoCraft AI — echocardiography assistant', tech: ['Capacitor', 'React'], hasGit: true, category: 'AI / Agents' },
  { name: 'formfill-app', description: 'FormFill AI — intelligent form auto-fill', tech: ['React'], hasGit: true, category: 'Tools / Utilities' },
  { name: 'hcm2024', description: 'Hypertrophic Cardiomyopathy Clinical Guide', tech: ['Next.js', 'React', 'TypeScript'], hasGit: true, category: 'Medical / Clinical' },
  { name: 'icu-infusion-pro', description: 'ICU Infusion Pro — critical care drug calculator', tech: ['React'], hasGit: true, category: 'Medical / Clinical' },
  { name: 'learn-react-first-time', description: 'React learning sandbox', tech: ['Vite', 'React'], hasGit: false, category: 'Learning / Research' },
  { name: 'llm_engineering', description: 'LLM Engineering — Master AI and LLMs', tech: [], hasGit: true, category: 'Learning / Research' },
  { name: 'machine-modeler', description: 'Machine Modeler simulation tool', tech: ['Vite', 'React'], hasGit: true, category: 'Tools / Utilities' },
  { name: 'mouse-recorder', description: 'Mouse action recorder & replay', tech: [], hasGit: true, category: 'Tools / Utilities' },
  { name: 'mouse-recorder-macos', description: 'Mouse Recorder for macOS native', tech: [], hasGit: true, category: 'Tools / Utilities' },
  { name: 'nullclaw', description: 'NullClaw — experimental Claude agent variant', tech: [], hasGit: true, category: 'AI / Agents' },
  { name: 'open-notebook', description: 'Open source research assistant inspired by Google NotebookLM', tech: ['Python'], hasGit: true, category: 'Learning / Research' },
  { name: 'openclaw-command-center', description: 'OpenClaw Command Center — agent monitoring dashboard', tech: ['Vite', 'React', 'TypeScript'], hasGit: true, category: 'AI / Agents' },
  { name: 'ottomator-agents', description: 'Live Agent Studio — multi-agent orchestration', tech: [], hasGit: true, category: 'AI / Agents' },
  { name: 'poodthai', description: 'Poodthai (พูดไทย) — Thai language learning app', tech: [], hasGit: true, category: 'Learning / Research' },
  { name: 'roam-research-mcp', description: 'MCP server for Roam Research API integration', tech: ['MCP', 'TypeScript'], hasGit: true, category: 'Learning / Research' },
  { name: 'rojo', description: 'Rojo project workspace', tech: [], hasGit: true, category: 'Other' },
  { name: 'skills', description: 'Claude Code custom skills collection', tech: [], hasGit: false, category: 'AI / Agents' },
];
