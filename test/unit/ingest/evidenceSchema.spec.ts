import { describe, expect, it } from 'vitest';
import { evidenceBundleSchema } from '../../../src/ingest/evidenceSchema.js';

describe('evidenceBundleSchema', () => {
  it('accepts a minimal valid bundle', () => {
    const bundle = {
      repoPath: '/tmp/my-app',
      generatedAt: new Date(0).toISOString(),
      packageJson: { scripts: {}, dependencies: {}, devDependencies: {} },
      buildConfig: [],
      routes: [],
      existingTests: [],
      signals: []
    };
    expect(() => evidenceBundleSchema.parse(bundle)).not.toThrow();
  });

  it('rejects a bundle missing repoPath', () => {
    const bundle = {
      generatedAt: new Date(0).toISOString(),
      packageJson: { scripts: {}, dependencies: {}, devDependencies: {} },
      buildConfig: [],
      routes: [],
      existingTests: [],
      signals: []
    };
    expect(() => evidenceBundleSchema.parse(bundle)).toThrow();
  });

  it('accepts a signal carrying an affirmative intent', () => {
    const bundle = {
      repoPath: '/tmp/my-app',
      generatedAt: new Date(0).toISOString(),
      packageJson: { scripts: {}, dependencies: {}, devDependencies: {} },
      buildConfig: [],
      routes: [{ path: '/api/users', method: 'GET', file: 'src/routes/users.ts', kind: 'api' }],
      existingTests: [],
      signals: [
        {
          id: 'sig-1',
          source: 'ingest',
          locator: { file: 'src/routes/users.ts', startLine: 10, endLine: 12 },
          topicKey: 'route:GET:/api/users',
          claim: 'returns 404 when id is missing',
          evidenceText: '// TODO: this 404 is a bug, should be 400',
          affirmativeIntent: {
            kind: 'todo',
            text: 'TODO: this 404 is a bug, should be 400',
            locator: { file: 'src/routes/users.ts', startLine: 10, endLine: 10 },
            confidence: 0.9
          },
          detectedAt: new Date(0).toISOString()
        }
      ]
    };
    expect(() => evidenceBundleSchema.parse(bundle)).not.toThrow();
  });
});
