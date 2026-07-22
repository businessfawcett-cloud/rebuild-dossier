import { describe, expect, it } from 'vitest';
import { generateTestDependencies } from '../../../src/spec/generateTestDependencies.js';
import type { GeneratedTestFile } from '../../../src/spec/generateTests.js';

describe('generateTestDependencies', () => {
  it('maps each test to its actual final directory and the route files it covers', () => {
    const file1: GeneratedTestFile = { filename: 'GET-users.spec.ts', content: '', sourceFile: 'src/routes/users.ts' };
    const file2: GeneratedTestFile = {
      filename: 'gate-redirect.spec.ts',
      content: '',
      sourceFile: 'app-shell.tsx',
      coveredRouteFiles: ['page.tsx', 'home/page.tsx']
    };

    const deps = generateTestDependencies([
      { file: file1, dir: 'visible' },
      { file: file2, dir: 'held-out' }
    ]);

    expect(deps).toEqual({
      'tests/visible/GET-users.spec.ts': ['src/routes/users.ts'],
      'tests/held-out/gate-redirect.spec.ts': ['page.tsx', 'home/page.tsx']
    });
  });

  it('reflects a test downgraded to tests/weak/ by the mutation check', () => {
    const file: GeneratedTestFile = { filename: 'weak.spec.ts', content: '', sourceFile: 'x.ts' };
    expect(generateTestDependencies([{ file, dir: 'weak' }])).toEqual({ 'tests/weak/weak.spec.ts': ['x.ts'] });
  });

  it('returns an empty object when there are no generated tests', () => {
    expect(generateTestDependencies([])).toEqual({});
  });
});
