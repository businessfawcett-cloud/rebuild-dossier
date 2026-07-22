import { describe, expect, it } from 'vitest';
import { generateParallelTestFixWorkflow } from '../../../src/spec/generateWorkflow.js';

describe('generateParallelTestFixWorkflow', () => {
  it('produces a valid workflow script: export const meta + a real orchestration body', () => {
    const file = generateParallelTestFixWorkflow();

    expect(file.filename).toBe('parallel-test-fix.js');
    expect(file.content).toContain('export const meta = {');
    expect(file.content).toContain("name: 'parallel-test-fix'");
    expect(file.content).toContain('test-dependencies.json');
    expect(file.content).toContain('await agent(');
    expect(file.content).toContain('await parallel(');
    expect(file.content).toContain("isolation: 'worktree'");
    expect(file.content).toContain('tests/held-out');
    // Never iterate against held-out — the workflow must not run it itself.
    expect(file.content).not.toMatch(/vitest run tests\/held-out/);
  });
});
