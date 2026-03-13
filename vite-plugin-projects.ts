import type { Plugin } from 'vite';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface ProjectMeta {
  name: string;
  description: string;
  deps: string[];
  devDeps: string[];
  hasGit: boolean;
  pyproject: boolean;
}

function scanProjects(projectsDir: string): ProjectMeta[] {
  const entries = readdirSync(projectsDir, { withFileTypes: true });
  const results: ProjectMeta[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = join(projectsDir, entry.name);
    const meta: ProjectMeta = {
      name: entry.name,
      description: '',
      deps: [],
      devDeps: [],
      hasGit: existsSync(join(dir, '.git')),
      pyproject: existsSync(join(dir, 'pyproject.toml')),
    };

    // package.json
    const pkgPath = join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        meta.description = pkg.description || '';
        meta.deps = Object.keys(pkg.dependencies || {});
        meta.devDeps = Object.keys(pkg.devDependencies || {});
      } catch { /* skip */ }
    }

    // README first meaningful line
    if (!meta.description) {
      const readmePath = join(dir, 'README.md');
      if (existsSync(readmePath)) {
        try {
          const lines = readFileSync(readmePath, 'utf-8').split('\n');
          for (const line of lines) {
            const clean = line.replace(/^#+\s*/, '').replace(/<[^>]+>/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').trim();
            if (clean && clean.length > 5 && !clean.startsWith('!') && !clean.startsWith('<')) {
              meta.description = clean.length > 120 ? clean.slice(0, 117) + '...' : clean;
              break;
            }
          }
        } catch { /* skip */ }
      }
    }

    // pyproject.toml description
    if (!meta.description && meta.pyproject) {
      const pyPath = join(dir, 'pyproject.toml');
      try {
        const content = readFileSync(pyPath, 'utf-8');
        const match = content.match(/description\s*=\s*"([^"]+)"/);
        if (match) meta.description = match[1];
      } catch { /* skip */ }
    }

    results.push(meta);
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
}

export default function projectsPlugin(): Plugin {
  const projectsDir = join(process.cwd(), '..');
  return {
    name: 'vite-plugin-projects',
    configureServer(server) {
      server.middlewares.use('/api/projects', (_req, res) => {
        try {
          const projects = scanProjects(projectsDir);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(projects));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(e) }));
        }
      });
    },
  };
}
