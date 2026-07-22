import { describe, expect, it } from 'vitest';
import { generateVerifyAgainstSpecSkill } from '../../../src/spec/generateSkill.js';
import type { RouteEntry } from '../../../src/ingest/evidenceSchema.js';

const routes: RouteEntry[] = [{ path: '/home', file: 'src/app/home/page.tsx', kind: 'page', startLine: 1 }];

describe('generateVerifyAgainstSpecSkill', () => {
  it('lists this project\'s actual contracts as a checklist, nested under its own directory', () => {
    const file = generateVerifyAgainstSpecSkill(routes);

    expect(file?.filename).toBe('verify-against-spec/SKILL.md');
    expect(file?.content).toMatch(/^---\ndescription:/);
    expect(file?.content).toContain('spec/contracts/PAGE-home.md');
    expect(file?.content).toContain('src/app/home/page.tsx');
    expect(file?.content).toContain('tests/visible');
    expect(file?.content).toContain('Do not touch, run, or reference tests/held-out');
  });

  it('returns null when there are no routes/contracts to check', () => {
    expect(generateVerifyAgainstSpecSkill([])).toBeNull();
  });
});
