import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { mkdtempSync, mkdirSync, cpSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { generateTests } from '../../../src/spec/generateTests.js';
import { runMutationCheck } from '../../../src/mutation/runMutationCheck.js';
import type { EvidenceBundle } from '../../../src/ingest/evidenceSchema.js';

const here = dirname(fileURLToPath(import.meta.url));
const aliasedRepoPath = join(here, '../../fixtures/aliased-repo');
const ownProjectRoot = join(here, '../../..');
const now = new Date(0).toISOString();

// tsconfig `@/*` path aliases are common well beyond Next.js (Vite, webpack,
// any bundler-resolution setup) — the mutation scratch copy previously had no
// way to resolve them at all, so any target file that imports through one
// would fail to load, not just fail the mutation. This is a generic fix, not
// Next.js-specific, so the fixture here deliberately avoids Next entirely.
describe('runMutationCheck against a repo using tsconfig @/* path aliases', () => {
  it('still kills a real mutation in a file reached only through an aliased import', () => {
    const evidence: EvidenceBundle = {
      repoPath: aliasedRepoPath,
      generatedAt: now,
      packageJson: { scripts: {}, dependencies: { express: '^4.19.0' }, devDependencies: {} },
      buildConfig: [],
      routes: [{ path: '/api/users/:id', method: 'GET', file: 'src/server.ts', kind: 'api', startLine: 6 }],
      existingTests: [],
      signals: []
    };

    const { visible, heldOut } = generateTests(aliasedRepoPath, evidence, []);
    const target = [...visible, ...heldOut][0]!;

    // The mutation site lives in src/lib/users.ts, reached from src/server.ts
    // only via the "@/lib/users" alias — this is exactly the path the fix
    // must resolve inside the scratch copy.
    const report = runMutationCheck(aliasedRepoPath, [{ ...target, sourceFile: 'src/lib/users.ts' }]);

    expect(report.results.length).toBeGreaterThan(0);
    expect(report.results.every((r) => r.killed)).toBe(true);
    expect(report.weakTestFiles).toEqual([]);
  }, 60000);

  // Caught by actually running the fix against a real installed app
  // (catchandtrade) rather than trusting the fixture above: that fixture has
  // NO node_modules of its own, so linkNodeModules falls back to
  // rebuild-dossier's own node_modules — which happens to have vitest, since
  // vitest is rebuild-dossier's own devDependency. A real target repo almost
  // always HAS its own node_modules (real runtime deps) but essentially never
  // has vitest as one of THEM (vitest is only ever used for the tests THIS
  // tool generates, never the target app's own tooling) — the injected
  // vitest.config.ts used to `import { defineConfig } from 'vitest/config'`,
  // which fails to resolve once the scratch copy's node_modules is the
  // target's own real one. This fixture is set up to reproduce that exact
  // gap: its own node_modules exists and has express, but not vitest.
  it('still resolves aliases when the repo has its own real node_modules that lacks vitest', () => {
    const repoCopy = mkdtempSync(join(tmpdir(), 'rebuild-dossier-aliased-own-nm-'));
    try {
      cpSync(aliasedRepoPath, repoCopy, { recursive: true });
      mkdirSync(join(repoCopy, 'node_modules'), { recursive: true });
      symlinkSync(join(ownProjectRoot, 'node_modules', 'express'), join(repoCopy, 'node_modules', 'express'), 'junction');

      const evidence: EvidenceBundle = {
        repoPath: repoCopy,
        generatedAt: now,
        packageJson: { scripts: {}, dependencies: { express: '^4.19.0' }, devDependencies: {} },
        buildConfig: [],
        routes: [{ path: '/api/users/:id', method: 'GET', file: 'src/server.ts', kind: 'api', startLine: 6 }],
        existingTests: [],
        signals: []
      };

      const { visible, heldOut } = generateTests(repoCopy, evidence, []);
      const target = [...visible, ...heldOut][0]!;

      const report = runMutationCheck(repoCopy, [{ ...target, sourceFile: 'src/lib/users.ts' }]);

      expect(report.unrunnableTestFiles).toEqual([]);
      expect(report.results.length).toBeGreaterThan(0);
      expect(report.results.every((r) => r.killed)).toBe(true);
      expect(report.weakTestFiles).toEqual([]);
    } finally {
      rmSync(repoCopy, { recursive: true, force: true });
    }
  }, 60000);
});
