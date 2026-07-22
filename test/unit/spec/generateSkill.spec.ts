import { describe, expect, it } from 'vitest';
import { generateVerifyAgainstSpecSkill } from '../../../src/spec/generateSkill.js';

describe('generateVerifyAgainstSpecSkill', () => {
  it('produces a SKILL.md nested under its own directory (the directory name is the /command)', () => {
    const file = generateVerifyAgainstSpecSkill();

    expect(file.filename).toBe('verify-against-spec/SKILL.md');
    expect(file.content).toMatch(/^---\ndescription:/);
    expect(file.content).toContain('spec/contracts/');
    expect(file.content).toContain('tests/visible');
    expect(file.content).toContain('Do not touch, run, or reference tests/held-out');
  });
});
