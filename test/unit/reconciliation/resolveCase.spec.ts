import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveCaseInternal } from '../../../src/reconciliation/resolveCase.js';
import { saveCases, loadCases } from '../../../src/state/caseStore.js';
import type { Case } from '../../../src/reconciliation/types.js';

function openCase(id: string): Case {
  return { id, topicKey: id, signals: [], matchedKnownBugs: [], status: 'open' };
}

describe('resolveCaseInternal', () => {
  it('marks a case resolved_by_human and records the decision, note, and channel', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-resolve-'));
    try {
      saveCases(dir, [openCase('case:1')]);

      const resolved = resolveCaseInternal(dir, 'case:1', 'intentional', 'confirmed with product', 'resolve_case_tool');

      expect(resolved?.status).toBe('resolved_by_human');
      expect(resolved?.humanDecision).toMatchObject({
        decision: 'intentional',
        note: 'confirmed with product',
        via: 'resolve_case_tool'
      });
      expect(loadCases(dir)[0]?.status).toBe('resolved_by_human');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('records the via channel as elicitation when resolved that way', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-resolve-'));
    try {
      saveCases(dir, [openCase('case:1')]);
      const resolved = resolveCaseInternal(dir, 'case:1', 'bug', undefined, 'elicitation');
      expect(resolved?.humanDecision?.via).toBe('elicitation');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns null when the case id does not exist', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-resolve-'));
    try {
      saveCases(dir, [openCase('case:1')]);
      expect(resolveCaseInternal(dir, 'case:does-not-exist', 'bug', undefined, 'resolve_case_tool')).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('leaves other cases untouched', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-resolve-'));
    try {
      saveCases(dir, [openCase('case:1'), openCase('case:2')]);
      resolveCaseInternal(dir, 'case:1', 'bug', undefined, 'resolve_case_tool');
      const cases = loadCases(dir);
      expect(cases.find((c) => c.id === 'case:2')?.status).toBe('open');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
