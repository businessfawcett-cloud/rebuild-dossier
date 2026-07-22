import { relative, sep } from 'node:path';

// All evidence/signal locators use posix-style relative paths regardless of
// host OS, so fixtures, tests, and generated spec output stay portable.
export function toPosixRelative(repoPath: string, filePath: string): string {
  return relative(repoPath, filePath).split(sep).join('/');
}
