import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
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

  it('warns when the target repo has no node_modules of its own — mutation-check results are unreliable without it', async () => {
    // Real finding: a user ran generate_spec against a real app they had
    // never `npm install`ed. Every generated test failed to even import its
    // dependencies, so every one landed in tests/weak/ as "unrunnable" — but
    // nothing in the output said why, and it was initially misdiagnosed as
    // a Prisma/database problem. Reproduced directly: removing node_modules
    // from a real target repo and re-running generate_spec gives the exact
    // same 0 visible / 0 held-out / all-unrunnable shape.
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-genspec-'));
    const outputDir = `${dir}-rebuild`;
    try {
      mkdirSync(join(dir, 'src', 'app', 'api', 'health'), { recursive: true });
      writeFileSync(
        join(dir, 'src', 'app', 'api', 'health', 'route.ts'),
        "import { NextResponse } from 'next/server';\nexport async function GET() {\n  return NextResponse.json({ status: 'ok' });\n}\n"
      );
      const evidence = minimalEvidence({
        packageJson: { name: 'sample-app', scripts: {}, dependencies: { next: '^14.0.0' }, devDependencies: {} },
        routes: [{ path: '/api/health', method: 'GET', file: 'src/app/api/health/route.ts', kind: 'api', startLine: 2 }]
      });
      atomicWriteFile(evidencePath(dir), JSON.stringify(evidence));
      saveCases(dir, []);

      const result = await generateSpecHandler({ repoPath: dir });
      const summary = JSON.parse(result.content[0]!.text);

      expect(summary.warning).toBeDefined();
      expect(summary.warning).toContain('node_modules');
      expect(summary.warning).toContain('npm install');
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(outputDir, { recursive: true, force: true });
    }
  }, 60000);

  it('does not warn when the target repo has its own node_modules', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-genspec-'));
    const outputDir = `${dir}-rebuild`;
    try {
      mkdirSync(join(dir, 'node_modules'), { recursive: true });
      atomicWriteFile(evidencePath(dir), JSON.stringify(minimalEvidence()));
      saveCases(dir, []);

      const result = await generateSpecHandler({ repoPath: dir });
      const summary = JSON.parse(result.content[0]!.text);

      expect(summary.warning).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
