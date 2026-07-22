import { describe, expect, it } from 'vitest';
import { matchKnownBug } from '../../../src/reconciliation/matchKnownBug.js';
import type { KnownBug, Signal } from '../../../src/reconciliation/types.js';

function bug(overrides: Partial<KnownBug>): KnownBug {
  return {
    id: 'bug-1',
    description: 'placeholder',
    matchHints: [],
    flaggedAt: new Date(0).toISOString(),
    ...overrides
  };
}

function signal(overrides: Partial<Signal>): Signal {
  return {
    id: 'sig-1',
    source: 'ingest',
    locator: { path: '/api/users/pagination', method: 'GET' },
    topicKey: 'route:GET:/api/users/pagination',
    claim: 'silently drops the last page of results',
    evidenceText: 'evidence',
    detectedAt: new Date(0).toISOString(),
    ...overrides
  };
}

describe('matchKnownBug', () => {
  it('matches when a hint token overlaps the signal locator path', () => {
    const b = bug({ matchHints: ['pagination'] });
    expect(matchKnownBug(b, [signal({})])).toBe(true);
  });

  it('matches when a hint token overlaps the signal claim text', () => {
    const b = bug({ matchHints: ['drops'] });
    expect(matchKnownBug(b, [signal({})])).toBe(true);
  });

  it('does not match on pure token intersection with no real overlap', () => {
    const b = bug({ matchHints: ['checkout', 'payment'] });
    expect(matchKnownBug(b, [signal({})])).toBe(false);
  });

  it('is case-insensitive', () => {
    const b = bug({ matchHints: ['PAGINATION'] });
    expect(matchKnownBug(b, [signal({})])).toBe(true);
  });

  it('returns false for a bug with no match hints at all', () => {
    const b = bug({ matchHints: [] });
    expect(matchKnownBug(b, [signal({})])).toBe(false);
  });
});
