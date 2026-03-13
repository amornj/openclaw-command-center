import { useState, useEffect, useMemo } from 'react';
import { fetchProjects, type Project } from '../data/projectsData';
import { trackPageView } from '../data/sessionUsage';

const CATEGORY_COLORS: Record<string, string> = {
  'Medical / Clinical': '#ef4444',
  'AI / Agents': '#8b5cf6',
  'Tools / Utilities': '#06b6d4',
  'Learning / Research': '#f59e0b',
  'Other': '#64748b',
};

const CATEGORY_ORDER = ['Medical / Clinical', 'AI / Agents', 'Tools / Utilities', 'Learning / Research', 'Other'];

function TechBadge({ tech }: { tech: string }) {
  return <span className="project-tech-badge">{tech}</span>;
}

function ProjectCard({ project }: { project: Project }) {
  const color = CATEGORY_COLORS[project.category] || '#64748b';
  return (
    <div className="project-card" style={{ borderTopColor: color }}>
      <div className="project-card-header">
        <span className="project-name">{project.name}</span>
        {project.hasGit && <span className="project-git-dot" title="Git repository">●</span>}
      </div>
      <p className="project-desc">{project.description}</p>
      {project.tech.length > 0 && (
        <div className="project-tech-row">
          {project.tech.map(t => <TechBadge key={t} tech={t} />)}
        </div>
      )}
    </div>
  );
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [source, setSource] = useState<'live' | 'seeded'>('seeded');
  const [filter, setFilter] = useState<string>('All');
  const [search, setSearch] = useState('');

  useEffect(() => {
    trackPageView('Projects');
    fetchProjects().then(({ projects, source }) => {
      setProjects(projects);
      setSource(source);
    });
  }, []);

  const categories = useMemo(() => {
    const cats = new Set(projects.map(p => p.category));
    return CATEGORY_ORDER.filter(c => cats.has(c));
  }, [projects]);

  const filtered = useMemo(() => {
    let list = projects;
    if (filter !== 'All') list = list.filter(p => p.category === filter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tech.some(t => t.toLowerCase().includes(q))
      );
    }
    return list;
  }, [projects, filter, search]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { All: projects.length };
    for (const p of projects) map[p.category] = (map[p.category] || 0) + 1;
    return map;
  }, [projects]);

  return (
    <div className="page projects-page">
      <div className="page-header">
        <h2>Projects</h2>
        <div className="page-header-right">
          <span className={`source-badge source-${source}`}>{source === 'live' ? '● Live' : '◦ Seeded'}</span>
          <span className="project-count">{filtered.length} projects</span>
        </div>
      </div>

      <div className="projects-toolbar">
        <div className="projects-filters">
          <button
            className={`filter-chip ${filter === 'All' ? 'active' : ''}`}
            onClick={() => setFilter('All')}
          >All ({counts.All})</button>
          {categories.map(c => (
            <button
              key={c}
              className={`filter-chip ${filter === c ? 'active' : ''}`}
              style={filter === c ? { borderColor: CATEGORY_COLORS[c], color: CATEGORY_COLORS[c] } : {}}
              onClick={() => setFilter(c)}
            >{c} ({counts[c] || 0})</button>
          ))}
        </div>
        <input
          className="projects-search"
          type="text"
          placeholder="Search projects..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="projects-grid">
        {filtered.map(p => <ProjectCard key={p.name} project={p} />)}
      </div>

      {filtered.length === 0 && (
        <div className="projects-empty">No projects match your search.</div>
      )}
    </div>
  );
}
