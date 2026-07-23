import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { rmSync } from 'node:fs';
import { ingestRepoHandler } from '../../../src/tools/ingestRepo.js';
import { evidencePath } from '../../../src/state/dossierPaths.js';
import { PathNotAllowedError } from '../../../src/security/pathAllowlist.js';

const here = dirname(fileURLToPath(import.meta.url));
const sampleRepoPath = join(here, '../../fixtures/sample-repo');

describe('ingest_repo tool', () => {
  it('ingests the sample repo and persists evidence.json under .dossier/', async () => {
    try {
      const result = await ingestRepoHandler({ path: sampleRepoPath });

      expect(existsSync(evidencePath(sampleRepoPath))).toBe(true);
      const saved = JSON.parse(readFileSync(evidencePath(sampleRepoPath), 'utf-8'));
      expect(saved.packageJson.name).toBe('sample-repo');

      const text = result.content[0]?.text ?? '';
      expect(text).toContain('routes');
    } finally {
      rmSync(join(sampleRepoPath, '.dossier'), { recursive: true, force: true });
    }
  });

  it('still succeeds for a path genuinely inside the configured allowlist (hosted mode)', async () => {
    const original = process.env.REBUILD_DOSSIER_ALLOWED_PATHS;
    process.env.REBUILD_DOSSIER_ALLOWED_PATHS = join(here, '../../fixtures');
    try {
      const result = await ingestRepoHandler({ path: sampleRepoPath });
      expect(result.content[0]?.text).toContain('routes');
    } finally {
      rmSync(join(sampleRepoPath, '.dossier'), { recursive: true, force: true });
      if (original === undefined) delete process.env.REBUILD_DOSSIER_ALLOWED_PATHS;
      else process.env.REBUILD_DOSSIER_ALLOWED_PATHS = original;
    }
  });

  it('rejects a path genuinely outside the allowlist', async () => {
    const original = process.env.REBUILD_DOSSIER_ALLOWED_PATHS;
    process.env.REBUILD_DOSSIER_ALLOWED_PATHS = join(here, '../../fixtures', 'sample-site'); // an unrelated sibling fixture dir
    try {
      await expect(ingestRepoHandler({ path: sampleRepoPath })).rejects.toThrow(PathNotAllowedError);
    } finally {
      if (original === undefined) delete process.env.REBUILD_DOSSIER_ALLOWED_PATHS;
      else process.env.REBUILD_DOSSIER_ALLOWED_PATHS = original;
    }
  });

  it('surfaces a monorepo hint when 0 routes are found at a workspace-root-shaped path', async () => {
    // Real, observed shape: pointing ingest_repo at a monorepo root (a thin
    // wrapper package.json with no routes of its own, no "workspaces" field,
    // no pnpm-workspace.yaml, only apps/*) silently returned 0 routes with
    // no indication the real app was one level down — someone using the
    // tool for real burned time debugging "why 0 routes" before finding it.
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-ingest-monorepo-'));
    try {
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'temp', private: true }));
      mkdirSync(join(dir, 'apps', 'web'), { recursive: true });
      writeFileSync(join(dir, 'apps', 'web', 'package.json'), JSON.stringify({ name: '@app/web', dependencies: { next: '^14.0.0' } }));

      const result = await ingestRepoHandler({ path: dir });
      const summary = JSON.parse(result.content[0]!.text);

      expect(summary.routes).toBe(0);
      expect(summary.monorepoHint).toBeDefined();
      expect(summary.monorepoHint.candidates).toEqual(['apps/web']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not surface a monorepo hint when routes are actually found', async () => {
    const result = await ingestRepoHandler({ path: sampleRepoPath });
    const summary = JSON.parse(result.content[0]!.text);
    expect(summary.routes).toBeGreaterThan(0);
    expect(summary.monorepoHint).toBeUndefined();
    rmSync(join(sampleRepoPath, '.dossier'), { recursive: true, force: true });
  });
});
