import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadCases, saveCases } from '../../../src/state/caseStore.js';
import type { Case } from '../../../src/reconciliation/types.js';

function kase(overrides: Partial<Case>): Case {
  return {
    id: 'case:route:GET:/api/users',
    topicKey: 'route:GET:/api/users',
    signals: [],
    matchedKnownBugs: [],
    status: 'open',
    ...overrides
  };
}

describe('caseStore', () => {
  it('returns an empty array when no cases have been saved yet', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-cases-'));
    try {
      expect(loadCases(dir)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('round-trips saved cases', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-cases-'));
    try {
      const cases = [kase({ id: 'c1' }), kase({ id: 'c2', status: 'auto_resolved' })];
      saveCases(dir, cases);
      expect(loadCases(dir)).toEqual(cases);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('overwrites the previous save rather than appending', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-cases-'));
    try {
      saveCases(dir, [kase({ id: 'c1' })]);
      saveCases(dir, [kase({ id: 'c2' })]);
      expect(loadCases(dir).map((c) => c.id)).toEqual(['c2']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
