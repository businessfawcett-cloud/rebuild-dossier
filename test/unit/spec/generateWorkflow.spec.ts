import { describe, expect, it } from 'vitest';
import { generateParallelTestFixWorkflow } from '../../../src/spec/generateWorkflow.js';
import type { TestCluster } from '../../../src/spec/clusterTests.js';

describe('generateParallelTestFixWorkflow', () => {
  it('bakes this project\'s actual precomputed clusters into the script, not a rediscovery step', () => {
    const clusters: TestCluster[] = [
      { tests: ['GET-users.spec.ts'], files: ['src/routes/users.ts'] },
      { tests: ['GET-orders.spec.ts'], files: ['src/routes/orders.ts'] }
    ];

    const file = generateParallelTestFixWorkflow(clusters);

    expect(file?.filename).toBe('parallel-test-fix.js');
    expect(file?.content).toContain('export const meta = {');
    expect(file?.content).toContain("name: 'parallel-test-fix'");
    expect(file?.content).toContain('GET-users.spec.ts');
    expect(file?.content).toContain('src/routes/orders.ts');
    expect(file?.content).toContain('await agent(');
    expect(file?.content).toContain('await parallel(');
    expect(file?.content).toContain("isolation: 'worktree'");
    expect(file?.content).toContain('tests/held-out');
    expect(file?.content).not.toMatch(/vitest run tests\/held-out/);
  });

  it('returns null when there are fewer than two clusters (nothing to actually parallelize)', () => {
    const oneCluster: TestCluster[] = [{ tests: ['a.spec.ts', 'b.spec.ts'], files: ['shared.ts'] }];
    expect(generateParallelTestFixWorkflow(oneCluster)).toBeNull();
    expect(generateParallelTestFixWorkflow([])).toBeNull();
  });
});
