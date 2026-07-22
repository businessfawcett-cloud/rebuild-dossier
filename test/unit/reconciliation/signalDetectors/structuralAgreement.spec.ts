import { describe, expect, it } from 'vitest';
import { structuralAgreement } from '../../../../src/reconciliation/signalDetectors/structuralAgreement.js';
import type { Signal } from '../../../../src/reconciliation/types.js';

function signal(overrides: Partial<Signal>): Signal {
  return {
    id: 'sig',
    source: 'ingest',
    locator: { path: '/api/users', method: 'GET' },
    topicKey: 'route:GET:/api/users',
    claim: 'returns 404 when id is missing',
    evidenceText: 'evidence',
    detectedAt: new Date(0).toISOString(),
    ...overrides
  };
}

describe('structuralAgreement', () => {
  it('is false when there is only one signal (nothing to agree with)', () => {
    expect(structuralAgreement([signal({ id: 's1' })])).toBe(false);
  });

  it('is true when two signals from different sources make the same claim', () => {
    const signals = [
      signal({ id: 's1', source: 'ingest', claim: 'returns 404 when id is missing' }),
      signal({ id: 's2', source: 'crawl', claim: 'Returns 404 when id is missing' })
    ];
    expect(structuralAgreement(signals)).toBe(true);
  });

  it('is false when signals disagree', () => {
    const signals = [
      signal({ id: 's1', source: 'ingest', claim: 'returns 404 when id is missing' }),
      signal({ id: 's2', source: 'crawl', claim: 'returns 200 with null when id is missing' })
    ];
    expect(structuralAgreement(signals)).toBe(false);
  });

  it('is false for an empty signal list', () => {
    expect(structuralAgreement([])).toBe(false);
  });
});
