import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { generateTests } from '../../../src/spec/generateTests.js';
import { runMutationCheck } from '../../../src/mutation/runMutationCheck.js';
import type { EvidenceBundle } from '../../../src/ingest/evidenceSchema.js';
import type { Case } from '../../../src/reconciliation/types.js';

const here = dirname(fileURLToPath(import.meta.url));
const sampleRepoPath = join(here, '../../fixtures/sample-repo');
const now = new Date(0).toISOString();

describe('runMutationCheck (integration, against the real sample-repo fixture)', () => {
  it('kills a test that asserts the real reconciled behavior (404 for a missing user)', () => {
    const evidence: EvidenceBundle = {
      repoPath: sampleRepoPath,
      generatedAt: now,
      packageJson: { scripts: {}, dependencies: { express: '^4.19.0' }, devDependencies: {} },
      buildConfig: [],
      routes: [{ path: '/api/users/:id', method: 'GET', file: 'src/server.ts', kind: 'api', startLine: 6 }],
      existingTests: [],
      signals: []
    };
    const cases: Case[] = [
      {
        id: 'case:route:GET:/api/users/:id',
        topicKey: 'route:GET:/api/users/:id',
        signals: [
          {
            id: 's1',
            source: 'ingest',
            locator: { file: 'src/server.ts', startLine: 8, endLine: 8 },
            topicKey: 'route:GET:/api/users/:id',
            claim: 'returns 404 when the user does not exist',
            evidenceText: 'e',
            detectedAt: now
          }
        ],
        matchedKnownBugs: [],
        status: 'auto_resolved',
        autoResolution: { decision: 'intentional', reason: 'r' }
      }
    ];

    const { visible, heldOut } = generateTests(sampleRepoPath, evidence, cases);
    const target = [...visible, ...heldOut][0]!;
    expect(target.content).toContain('from-reconciliation');

    const report = runMutationCheck(sampleRepoPath, [{ ...target, sourceFile: 'src/server.ts' }]);

    expect(report.results.length).toBeGreaterThan(0);
    expect(report.results.every((r) => r.killed)).toBe(true);
    expect(report.weakTestFiles).toEqual([]);
  }, 60000);
});
