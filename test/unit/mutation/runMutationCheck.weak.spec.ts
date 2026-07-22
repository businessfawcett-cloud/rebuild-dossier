import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateTests } from '../../../src/spec/generateTests.js';
import { runMutationCheck } from '../../../src/mutation/runMutationCheck.js';
import type { EvidenceBundle } from '../../../src/ingest/evidenceSchema.js';

describe('runMutationCheck flags a weak test', () => {
  it('does not kill a mutation that changes the response but keeps status < 500, and flags the test weak', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-weak-'));
    try {
      writeFileSync(
        join(dir, 'server.ts'),
        [
          "import express from 'express';",
          'const app = express();',
          "app.get('/x', (req, res) => {",
          '  const ok = 1 === 1;',
          '  if (ok) return res.status(200).json({});',
          '  return res.status(201).json({});',
          '});',
          'export default app;'
        ].join('\n')
      );

      const evidence: EvidenceBundle = {
        repoPath: dir,
        generatedAt: new Date(0).toISOString(),
        packageJson: { scripts: {}, dependencies: { express: '^4.19.0' }, devDependencies: {} },
        buildConfig: [],
        routes: [{ path: '/x', method: 'GET', file: 'server.ts', kind: 'api', startLine: 3 }],
        existingTests: [],
        signals: []
      };

      // No resolved case supplied — only the generic existence check gets generated.
      const { visible, heldOut } = generateTests(dir, evidence, []);
      const target = [...visible, ...heldOut][0]!;
      expect(target.content).not.toContain('from-reconciliation');

      const report = runMutationCheck(dir, [{ ...target, sourceFile: 'server.ts' }]);

      expect(report.results.length).toBeGreaterThan(0);
      expect(report.results.every((r) => !r.killed)).toBe(true);
      expect(report.weakTestFiles).toEqual([target.filename]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60000);
});
