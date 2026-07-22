import { relative, resolve, isAbsolute } from 'node:path';

// Only matters once a tool call can arrive from somewhere other than a
// trusted local stdio client — a network-reachable server must never let a
// caller name an arbitrary path on the host filesystem. `path.relative` is
// the standard safe boundary check: a naive string-prefix comparison would
// let "/allowed/projects-evil" pass a check meant for "/allowed/projects".
function isWithinRoot(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

export function isPathAllowed(targetPath: string, allowedRoots: string[]): boolean {
  if (allowedRoots.length === 0) return false;
  const resolvedTarget = resolve(targetPath);
  return allowedRoots.some((root) => isWithinRoot(resolve(root), resolvedTarget));
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
// is set (as it always is for the hosted HTTP deployment), every tool call
// enforces it.
export function enforcePathAllowlist(targetPath: string): void {
  const allowedRoots = parseAllowedRoots(process.env.REBUILD_DOSSIER_ALLOWED_PATHS);
  if (allowedRoots.length === 0) return;
  assertPathAllowed(targetPath, allowedRoots);
}
