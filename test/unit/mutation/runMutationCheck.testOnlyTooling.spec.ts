import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMutationCheck } from '../../../src/mutation/runMutationCheck.js';

const here = dirname(fileURLToPath(import.meta.url));
const ownProjectRoot = join(here, '../../..');

// Caught by actually running the real gate-test pipeline against Madeline
// (not a fixture): once a target repo has its own real node_modules (true
// for every real app), linkNodeModules picked that as the ONLY source —
// correct for the app's own real dependencies, but playwright is never one
// of THOSE (it's only ever needed by the gate test THIS tool generates), so
// it silently became unresolvable, and every gate-test mutation check against
// a real app failed at import time. This fixture reproduces the shape
// directly (own node_modules present, has express, lacks playwright) without
// needing a full Next.js app or a real `next dev` boot.
describe('runMutationCheck against a repo with its own node_modules that lacks playwright', () => {
  it('still resolves playwright for a generated test, via the fallback overlay', () => {
    const repoDir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-own-nm-no-pw-'));
    try {
      mkdirSync(join(repoDir, 'node_modules'), { recursive: true });
      symlinkSync(join(ownProjectRoot, 'node_modules', 'express'), join(repoDir, 'node_modules', 'express'), 'junction');
      writeFileSync(repoDir + '/trivial.ts', 'export const x = 1;\nif (!x) {\n  throw new Error("unreachable");\n}\n');

      const target = {
        filename: 'uses-playwright.spec.ts',
        content: [
          "import { describe, it, expect } from 'vitest';",
          "import { chromium } from 'playwright';",
          "describe('playwright resolves', () => {",
          "  it('has chromium', () => {",
          "    expect(typeof chromium).toBe('object');",
          '  });',
          '});',
          ''
        ].join('\n'),
        sourceFile: 'trivial.ts'
      };

      const report = runMutationCheck(repoDir, [target]);

      expect(report.unrunnableTestFiles).toEqual([]);
      expect(report.results.length).toBeGreaterThan(0);
    } finally {
      rmSync(repoDir, { recursive: true, force: true });
    }
  }, 60000);
});
