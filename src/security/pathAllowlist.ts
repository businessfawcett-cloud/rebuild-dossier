import { relative, resolve, isAbsolute, dirname, basename, join } from 'node:path';
import { realpathSync } from 'node:fs';

// Only matters once a tool call can arrive from somewhere other than a
// trusted local stdio client — a network-reachable server must never let a
// caller name an arbitrary path on the host filesystem. `path.relative` is
// the standard safe boundary check: a naive string-prefix comparison would
// let "/allowed/projects-evil" pass a check meant for "/allowed/projects".
function isWithinRoot(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

// A textually-contained path can still escape the root via a symlink/junction
// planted inside it — resolving through path.resolve() alone never follows
// those. This walks up to the deepest ancestor that actually exists, resolves
// *that* through the filesystem (following any symlinks along the way), then
// re-appends whatever suffix doesn't exist yet (e.g. generate_spec's
// <repo>-rebuild/ output dir, which is checked before it's ever created).
function resolveRealPath(target: string): string {
  let current = resolve(target);
  const pendingSuffix: string[] = [];
  while (true) {
    try {
      const real = realpathSync(current);
      return pendingSuffix.length > 0 ? join(real, ...pendingSuffix) : real;
    } catch {
      const parent = dirname(current);
      if (parent === current) return join(current, ...pendingSuffix); // hit filesystem root, nothing exists
      pendingSuffix.unshift(basename(current));
      current = parent;
    }
  }
}

export function isPathAllowed(targetPath: string, allowedRoots: string[]): boolean {
  if (allowedRoots.length === 0) return false;
  const resolvedTarget = resolveRealPath(targetPath);
  return allowedRoots.some((root) => isWithinRoot(resolveRealPath(root), resolvedTarget));
}

export class PathNotAllowedError extends Error {
  constructor(targetPath: string) {
    // Deliberately does not enumerate the configured allowlist in the
    // message — that's server configuration, not something to hand back to
    // whichever caller just got rejected.
    super(`Path is not within any allowed directory for this server: ${resolve(targetPath)}`);
    this.name = 'PathNotAllowedError';
  }
}

export function assertPathAllowed(targetPath: string, allowedRoots: string[]): void {
  if (!isPathAllowed(targetPath, allowedRoots)) {
    throw new PathNotAllowedError(targetPath);
  }
}

export function parseAllowedRoots(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => resolve(entry));
}

// Opt-in: unset (the default for local stdio usage) means no restriction at
// all, identical to today's behavior — a locally-spawned process already has
// the calling user's full filesystem access, so sandboxing it against itself
// adds friction with no real security benefit. Once REBUILD_DOSSIER_ALLOWED_PATHS
// is set (as it must be to run in HTTP mode at all — see httpServer.ts's
// startup checks), every tool call
// enforces it.
export function enforcePathAllowlist(targetPath: string): void {
  const allowedRoots = parseAllowedRoots(process.env.REBUILD_DOSSIER_ALLOWED_PATHS);
  if (allowedRoots.length === 0) return;
  assertPathAllowed(targetPath, allowedRoots);
}
