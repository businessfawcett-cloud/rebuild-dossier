import { describe, expect, it } from 'vitest';
import { generateSpecAuditorAgent, generateTestVerifierAgent } from '../../../src/spec/generateAgents.js';

describe('generateSpecAuditorAgent', () => {
  it('produces a valid subagent file: name/description/tools frontmatter + body', () => {
    const file = generateSpecAuditorAgent();

    expect(file.filename).toBe('spec-auditor.md');
    expect(file.content).toMatch(/^---\nname: spec-auditor\n/);
    expect(file.content).toContain('description:');
    expect(file.content).toContain('tools: Read, Grep, Glob');
    expect(file.content).toContain('spec/contracts/');
  });
});

describe('generateTestVerifierAgent', () => {
  it('produces a valid subagent file that runs held-out tests in isolation', () => {
    const file = generateTestVerifierAgent();

    expect(file.filename).toBe('test-verifier.md');
    expect(file.content).toMatch(/^---\nname: test-verifier\n/);
    expect(file.content).toContain('tools: Bash, Read');
    expect(file.content).toContain('tests/held-out');
    expect(file.content).not.toContain('tests/visible');
  });
});
