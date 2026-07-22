import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// A rebuild agent is free to `npm install` whatever satisfies a version
// range, and nothing about a range like "^16.0.0" stops it from landing on
// a different major/minor than the original app actually ran — real
// observed failure: a weak-model handoff drifted from next@16.2.10 (the
// real app) to next@14.2.35, silently eliminating a real bug the rebuild
// was supposed to reproduce and get caught by its own tests. Pinning the
// exact version the original app has actually installed removes this
// entirely, the same way interface contracts are locked rather than left to
// judgment.
export function pinDependencyVersions(repoPath: string, dependencies: Record<string, string>): Record<string, string> {
  const pinned: Record<string, string> = {};
  for (const [name, range] of Object.entries(dependencies)) {
    const installedPackageJson = join(repoPath, 'node_modules', name, 'package.json');
    if (existsSync(installedPackageJson)) {
      try {
        const installed = JSON.parse(readFileSync(installedPackageJson, 'utf-8'));
        if (typeof installed.version === 'string') {
          pinned[name] = installed.version;
          continue;
        }
      } catch {
        // fall through to the range fallback below
      }
    }
    pinned[name] = range; // never actually installed (e.g. a repo that was never `npm install`ed) — nothing more precise to fall back to
  }
  return pinned;
}
