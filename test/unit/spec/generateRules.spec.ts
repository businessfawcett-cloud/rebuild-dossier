import { describe, expect, it } from 'vitest';
import { generateTestingRule } from '../../../src/spec/generateRules.js';

describe('generateTestingRule', () => {
  it('names the test command and the held-out policy', () => {
    const rule = generateTestingRule('npm test');

    expect(rule.filename).toBe('testing.md');
    expect(rule.content).toContain('npm test');
    expect(rule.content).toContain('tests/held-out/');
    expect(rule.content).toContain('once');
  });
});
