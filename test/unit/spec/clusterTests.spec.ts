import { describe, expect, it } from 'vitest';
import { clusterTestsByFile } from '../../../src/spec/clusterTests.js';
import type { GeneratedTestFile } from '../../../src/spec/generateTests.js';

function file(filename: string, sourceFile: string, coveredRouteFiles?: string[]): GeneratedTestFile {
  return { filename, content: '', sourceFile, coveredRouteFiles };
}

describe('clusterTestsByFile', () => {
  it('puts two tests that share a covered file in the same cluster', () => {
    const clusters = clusterTestsByFile([
      file('gate-redirect.spec.ts', 'app-shell.tsx', ['page.tsx', 'home/page.tsx']),
      file('gate-secret-entry.spec.ts', 'login-gate.tsx', ['page.tsx', 'home/page.tsx'])
    ]);

    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.tests.sort()).toEqual(['gate-redirect.spec.ts', 'gate-secret-entry.spec.ts']);
    expect(clusters[0]?.files.sort()).toEqual(['home/page.tsx', 'page.tsx']);
  });

  it('puts tests on fully disjoint files in separate clusters', () => {
    const clusters = clusterTestsByFile([
      file('GET-users.spec.ts', 'src/routes/users.ts'),
      file('GET-orders.spec.ts', 'src/routes/orders.ts')
    ]);

    expect(clusters).toHaveLength(2);
    expect(clusters.map((c) => c.tests[0]).sort()).toEqual(['GET-orders.spec.ts', 'GET-users.spec.ts']);
  });

  it('transitively merges a chain of shared files into one cluster', () => {
    // A shares a file with B, B shares a different file with C -> all one cluster.
    const clusters = clusterTestsByFile([
      file('a.spec.ts', 'x.ts', ['shared1.ts']),
      file('b.spec.ts', 'y.ts', ['shared1.ts', 'shared2.ts']),
      file('c.spec.ts', 'z.ts', ['shared2.ts'])
    ]);

    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.tests.sort()).toEqual(['a.spec.ts', 'b.spec.ts', 'c.spec.ts']);
  });

  it('falls back to sourceFile when coveredRouteFiles is absent', () => {
    const clusters = clusterTestsByFile([file('a.spec.ts', 'shared.ts'), file('b.spec.ts', 'shared.ts')]);
    expect(clusters).toHaveLength(1);
  });

  it('returns an empty array for no tests', () => {
    expect(clusterTestsByFile([])).toEqual([]);
  });
});
