import { describe, expect, it } from 'vitest';
import { generateSpecAuditorAgent, generateTestVerifierAgent } from '../../../src/spec/generateAgents.js';
import type { RouteEntry } from '../../../src/ingest/evidenceSchema.js';

const routes: RouteEntry[] = [
  { path: '/api/users/:id', method: 'GET', file: 'src/routes/users.ts', kind: 'api', startLine: 6 },
  { path: '/home', file: 'src/app/home/page.tsx', kind: 'page', startLine: 1 }
];

describe('generateSpecAuditorAgent', () => {
  it('lists this project\'s actual contract-to-file mappings, not a generic instruction', () => {
    const file = generateSpecAuditorAgent(routes);

    expect(file?.filename).toBe('spec-auditor.md');
    expect(file?.content).toMatch(/^---\nname: spec-auditor\n/);
    expect(file?.content).toContain('tools: Read, Grep, Glob');
    expect(file?.content).toContain('GET /api/users/:id');
    expect(file?.content).toContain('spec/contracts/GET-api-users-id.md');
    expect(file?.content).toContain('src/routes/users.ts');
    expect(file?.content).toContain('/home');
    expect(file?.content).toContain('spec/contracts/PAGE-home.md');
    expect(file?.content).toContain('src/app/home/page.tsx');
  });

  it('returns null when there are no routes/contracts to audit', () => {
    expect(generateSpecAuditorAgent([])).toBeNull();
  });
});

describe('generateTestVerifierAgent', () => {
  it('lists this project\'s actual held-out test files', () => {
    const file = generateTestVerifierAgent(['GET-orders.spec.ts', 'gate-redirect.spec.ts']);

    expect(file?.filename).toBe('test-verifier.md');
    expect(file?.content).toMatch(/^---\nname: test-verifier\n/);
    expect(file?.content).toContain('tools: Bash, Read');
    expect(file?.content).toContain('tests/held-out');
    expect(file?.content).toContain('GET-orders.spec.ts');
    expect(file?.content).toContain('gate-redirect.spec.ts');
    expect(file?.content).toContain('2');
  });

  it('returns null when there are no held-out tests for this project (nothing to verify in isolation)', () => {
    expect(generateTestVerifierAgent([])).toBeNull();
  });
});
