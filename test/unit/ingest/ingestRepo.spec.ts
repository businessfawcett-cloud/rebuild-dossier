import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { ingestRepo } from '../../../src/ingest/ingestRepo.js';

const here = dirname(fileURLToPath(import.meta.url));
const sampleRepoPath = join(here, '../../fixtures/sample-repo');

describe('ingestRepo', () => {
  it('produces a full evidence bundle for the sample Express repo', async () => {
    const bundle = await ingestRepo(sampleRepoPath);

    expect(bundle.repoPath).toBe(sampleRepoPath);
    expect(bundle.packageJson.name).toBe('sample-repo');

    expect(bundle.routes).toContainEqual({
      path: '/api/users/:id',
      method: 'GET',
      file: 'src/server.ts',
      kind: 'api',
      startLine: 6
    });
    expect(bundle.routes).toContainEqual({
      path: '/api/users',
      method: 'POST',
      file: 'src/server.ts',
      kind: 'api',
      startLine: 18
    });

    expect(bundle.existingTests).toContainEqual({
      file: 'src/server.spec.ts',
      framework: 'vitest',
      testNames: ['returns 404 for an unknown user', 'returns 201 when creating a user']
    });

    const todoSignal = bundle.signals.find((s) => s.affirmativeIntent?.kind === 'todo');
    expect(todoSignal).toBeDefined();
    expect(todoSignal?.affirmativeIntent?.text).toContain('should be a 400');
    // The TODO sits inside the GET /api/users/:id handler — it should be
    // grouped under that route's topicKey, not just the whole file.
    expect(todoSignal?.topicKey).toBe('route:GET:/api/users/:id');

    expect(bundle.buildConfig).toEqual([]);
  });

  it('never scans node_modules even if present', async () => {
    const bundle = await ingestRepo(sampleRepoPath);
    expect(bundle.routes.every((r) => !r.file.includes('node_modules'))).toBe(true);
  });
});
