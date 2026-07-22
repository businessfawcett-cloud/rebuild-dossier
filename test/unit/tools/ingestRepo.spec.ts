import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { rmSync } from 'node:fs';
import { ingestRepoHandler } from '../../../src/tools/ingestRepo.js';
import { evidencePath } from '../../../src/state/dossierPaths.js';

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
});
