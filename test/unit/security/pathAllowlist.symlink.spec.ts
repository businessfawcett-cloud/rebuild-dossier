import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, symlinkSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isPathAllowed } from '../../../src/security/pathAllowlist.js';

// A network-reachable server must not let a symlink/junction planted inside
// (or reachable through) an allowed directory redirect reads/writes anywhere
// else on the host filesystem — a textual containment check alone can't see
// this, only resolving the real (symlink-following) path can.
describe('isPathAllowed against symlink/junction escapes', () => {
  it('rejects a path that escapes the allowed root via a directory symlink/junction', () => {
    const base = mkdtempSync(join(tmpdir(), 'rebuild-dossier-symlink-'));
    try {
      const allowedRoot = join(base, 'allowed-root');
      const repo = join(allowedRoot, 'repo');
      const outsideSecret = join(base, 'outside-secret');
      mkdirSync(repo, { recursive: true });
      mkdirSync(outsideSecret, { recursive: true });
      writeFileSync(join(outsideSecret, 'passwd.txt'), 'top secret');

      const escapeLink = join(repo, 'escape');
      symlinkSync(outsideSecret, escapeLink, process.platform === 'win32' ? 'junction' : 'dir');

      expect(isPathAllowed(escapeLink, [allowedRoot])).toBe(false);
      expect(isPathAllowed(join(escapeLink, 'passwd.txt'), [allowedRoot])).toBe(false);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it('still allows an ordinary path with no symlinks involved', () => {
    const base = mkdtempSync(join(tmpdir(), 'rebuild-dossier-symlink-'));
    try {
      const allowedRoot = join(base, 'allowed-root');
      const repo = join(allowedRoot, 'repo');
      mkdirSync(repo, { recursive: true });

      expect(isPathAllowed(repo, [allowedRoot])).toBe(true);
      expect(isPathAllowed(join(repo, 'src', 'index.ts'), [allowedRoot])).toBe(true);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it('still allows a path whose components do not exist yet (e.g. generate_spec output dir)', () => {
    const base = mkdtempSync(join(tmpdir(), 'rebuild-dossier-symlink-'));
    try {
      const allowedRoot = join(base, 'allowed-root');
      mkdirSync(allowedRoot, { recursive: true });

      const notYetCreated = join(allowedRoot, 'some-app-rebuild', 'CLAUDE.md');
      expect(isPathAllowed(notYetCreated, [allowedRoot])).toBe(true);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});
