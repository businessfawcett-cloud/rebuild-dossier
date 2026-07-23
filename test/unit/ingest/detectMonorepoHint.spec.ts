import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findCandidateAppDirs } from '../../../src/ingest/detectMonorepoHint.js';

describe('findCandidateAppDirs', () => {
  it('finds candidate apps under apps/*, even with no workspaces field or workspace manifest', () => {
    // Real, observed shape: catchandtrade's own root package.json has no
    // "workspaces" field at all, and there's no pnpm-workspace.yaml either —
    // only a turbo.json (which itself doesn't declare packages explicitly).
    // Detection can't rely on a manifest declaration; it has to look at the
    // actual directory convention.
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-monorepo-'));
    try {
      mkdirSync(join(dir, 'apps', 'web'), { recursive: true });
      writeFileSync(join(dir, 'apps', 'web', 'package.json'), JSON.stringify({ name: '@app/web' }));
      mkdirSync(join(dir, 'apps', 'admin'), { recursive: true });
      writeFileSync(join(dir, 'apps', 'admin', 'package.json'), JSON.stringify({ name: '@app/admin' }));

      const candidates = findCandidateAppDirs(dir);

      expect(candidates.sort()).toEqual(['apps/admin', 'apps/web']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('also finds candidates under packages/*', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-monorepo-'));
    try {
      mkdirSync(join(dir, 'packages', 'db'), { recursive: true });
      writeFileSync(join(dir, 'packages', 'db', 'package.json'), JSON.stringify({ name: '@pkg/db' }));

      expect(findCandidateAppDirs(dir)).toEqual(['packages/db']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('ignores an apps/ or packages/ entry with no package.json (not a real package)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-monorepo-'));
    try {
      mkdirSync(join(dir, 'apps', 'empty-dir'), { recursive: true });

      expect(findCandidateAppDirs(dir)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns an empty array for an ordinary, non-monorepo repo', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-monorepo-'));
    try {
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'ordinary-app' }));
      expect(findCandidateAppDirs(dir)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
