import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { toPosixRelative } from '../util/paths.js';

const CANDIDATE_PARENT_DIRS = ['apps', 'packages'];

// Deliberately does not rely on a "workspaces" field in package.json, or a
// pnpm-workspace.yaml — a real, observed monorepo (catchandtrade) has
// neither: its root package.json never declares workspaces at all, and the
// only monorepo signal present is a turbo.json that itself doesn't list
// packages explicitly. Detection has to look at the directory convention
// directly (apps/*, packages/*) rather than trust a manifest declaration
// that may be missing or incomplete on a real, messy repo.
export function findCandidateAppDirs(repoPath: string): string[] {
  const candidates: string[] = [];

  for (const parent of CANDIDATE_PARENT_DIRS) {
    const parentPath = join(repoPath, parent);
    if (!existsSync(parentPath) || !statSync(parentPath).isDirectory()) continue;

    for (const entry of readdirSync(parentPath)) {
      const candidatePath = join(parentPath, entry);
      if (!statSync(candidatePath).isDirectory()) continue;
      if (!existsSync(join(candidatePath, 'package.json'))) continue;
      candidates.push(toPosixRelative(repoPath, candidatePath));
    }
  }

  return candidates;
}
