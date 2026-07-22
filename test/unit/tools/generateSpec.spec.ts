import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateSpecHandler } from '../../../src/tools/generateSpec.js';
import { evidencePath } from '../../../src/state/dossierPaths.js';
import { atomicWriteFile } from '../../../src/state/atomicWrite.js';
import { saveCases } from '../../../src/state/caseStore.js';
import type { EvidenceBundle } from '../../../src/ingest/evidenceSchema.js';
import type { Case } from '../../../src/reconciliation/types.js';

const now = new Date(0).toISOString();

function minimalEvidence(overrides: Partial<EvidenceBundle> = {}): EvidenceBundle {
  return {
    repoPath: 'irrelevant',
    generatedAt: now,
    packageJson: { name: 'sample-app', scripts: {}, dependencies: {}, devDependencies: {} },
    buildConfig: [],
    routes: [],
    existingTests: [],
    signals: [],
    ...overrides
  };
}

describe('generate_spec tool', () => {
  it('refuses to run while any case is still open', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-genspec-'));
    const outputDir = `${dir}-rebuild`;
    try {
      atomicWriteFile(evidencePath(dir), JSON.stringify(minimalEvidence()));
      saveCases(dir, [{ id: 'case:1', topicKey: 'x', signals: [], matchedKnownBugs: [], status: 'open' }]);

      const result = await generateSpecHandler({ repoPath: dir });

      expect(result.isError).toBe(true);
      expect(existsSync(outputDir)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('writes the sibling <repo>-rebuild directory once the queue is empty', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-genspec-'));
    const outputDir = `${dir}-rebuild`;
    try {
      atomicWriteFile(evidencePath(dir), JSON.stringify(minimalEvidence()));
      saveCases(dir, []);

      const result = await generateSpecHandler({ repoPath: dir });

      expect(result.isError).toBeUndefined();
      expect(existsSync(join(outputDir, 'CLAUDE.md'))).toBe(true);
      expect(existsSync(join(dir, 'CLAUDE.md'))).toBe(false); // never written into the original repo
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('reports an error when no evidence has been ingested yet', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-genspec-'));
    try {
      const result = await generateSpecHandler({ repoPath: dir });
      expect(result.isError).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
