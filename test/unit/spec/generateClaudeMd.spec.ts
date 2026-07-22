import { describe, expect, it } from 'vitest';
import { generateClaudeMd } from '../../../src/spec/generateClaudeMd.js';

describe('generateClaudeMd', () => {
  it('includes the project name, stack lines, and the non-negotiable rules', () => {
    const content = generateClaudeMd({ projectName: 'sample-repo', stackLines: ['lang: TypeScript / Express'], testCommand: 'npm test' });

    expect(content).toContain('# Project: sample-repo (rebuild)');
    expect(content).toContain('lang: TypeScript / Express');
    expect(content).toContain('TDD strict');
    expect(content).toContain('spec/contracts/');
    expect(content).toContain('tests/held-out/');
    expect(content).toContain('npm test');
    expect(content).toContain('dependency versions already pinned in package.json are locked');
  });

  it('stays short — a few dozen lines, not an essay', () => {
    const content = generateClaudeMd({ projectName: 'x', stackLines: ['lang: Python'], testCommand: 'pytest' });
    expect(content.split('\n').length).toBeLessThan(40);
  });
});
