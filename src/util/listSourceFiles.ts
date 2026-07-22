import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.dossier', 'coverage']);

export function listSourceFiles(repoPath: string): string[] {
  const files: string[] = [];

  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      if (IGNORED_DIRS.has(entry)) continue;
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (SOURCE_EXTENSIONS.has(entry.slice(entry.lastIndexOf('.')))) {
        files.push(fullPath);
      }
    }
  }

  walk(repoPath);
  return files;
}
