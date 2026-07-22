import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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
});
