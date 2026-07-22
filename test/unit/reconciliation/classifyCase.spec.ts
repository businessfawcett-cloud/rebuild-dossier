import { describe, expect, it } from 'vitest';
import { classifyCase } from '../../../src/reconciliation/classifyCase.js';
import type { KnownBug, Signal } from '../../../src/reconciliation/types.js';

const topicKey = 'route:GET:/api/users/:id';
const now = new Date(0).toISOString();

function signal(overrides: Partial<Signal>): Signal {
  return {
    id: overrides.id ?? 'sig',
    source: 'ingest',
    locator: { path: '/api/users/:id', method: 'GET' },
    topicKey,
    claim: 'returns 404 when id is missing',
    evidenceText: 'evidence',
    detectedAt: now,
    ...overrides
  };
}

function bug(overrides: Partial<KnownBug>): KnownBug {
  return {
    id: overrides.id ?? 'bug',
    description: 'placeholder',
    matchHints: [],
    flaggedAt: now,
    ...overrides
  };
}

describe('classifyCase — the non-negotiable reconciliation rules', () => {
  it('1. silent agreement, no affirmative intent -> open (the core non-negotiable rule)', () => {
    const signals = [
      signal({ id: 's1', source: 'ingest', claim: 'returns 404 when id is missing' }),
      signal({ id: 's2', source: 'crawl', claim: 'returns 404 when id is missing' })
    ];
    const result = classifyCase({ id: 'c1', topicKey, signals, knownBugs: [] });
    expect(result.status).toBe('open');
  });

  it('2. agreement + comment stating a reason -> auto_resolved, "intentional"', () => {
    const signals = [
      signal({ id: 's1', source: 'ingest', claim: 'returns 404 when id is missing' }),
      signal({
        id: 's2',
        source: 'ingest',
        claim: 'returns 404 when id is missing',
        affirmativeIntent: {
          kind: 'comment',
          text: '// intentional: id is required, 404 signals a bad request upstream',
          locator: { file: 'src/routes/users.ts', startLine: 5, endLine: 5 },
          confidence: 0.8
        }
      })
    ];
    const result = classifyCase({ id: 'c2', topicKey, signals, knownBugs: [] });
    expect(result.status).toBe('auto_resolved');
    expect(result.autoResolution?.decision).toBe('intentional');
  });

  it('3. agreement + TODO/FIXME -> auto_resolved, "bug"', () => {
    const signals = [
      signal({ id: 's1', source: 'ingest', claim: 'returns 404 when id is missing' }),
      signal({
        id: 's2',
        source: 'ingest',
        claim: 'returns 404 when id is missing',
        affirmativeIntent: {
          kind: 'todo',
          text: '// TODO this should be a 400 not a 404',
          locator: { file: 'src/routes/users.ts', startLine: 5, endLine: 5 },
          confidence: 0.8
        }
      })
    ];
    const result = classifyCase({ id: 'c3', topicKey, signals, knownBugs: [] });
    expect(result.status).toBe('auto_resolved');
    expect(result.autoResolution?.decision).toBe('bug');
  });

  it('4. disagreement, no intent -> open', () => {
    const signals = [
      signal({ id: 's1', source: 'ingest', claim: 'returns 404 when id is missing' }),
      signal({ id: 's2', source: 'crawl', claim: 'returns 200 with null when id is missing' })
    ];
    const result = classifyCase({ id: 'c4', topicKey, signals, knownBugs: [] });
    expect(result.status).toBe('open');
  });

  it('5. disagreement, with intent -> open (intent alone without agreement is not enough)', () => {
    const signals = [
      signal({ id: 's1', source: 'ingest', claim: 'returns 404 when id is missing' }),
      signal({
        id: 's2',
        source: 'crawl',
        claim: 'returns 200 with null when id is missing',
        affirmativeIntent: {
          kind: 'comment',
          text: '// intentional design choice',
          locator: { file: 'src/routes/users.ts', startLine: 5, endLine: 5 },
          confidence: 0.8
        }
      })
    ];
    const result = classifyCase({ id: 'c5', topicKey, signals, knownBugs: [] });
    expect(result.status).toBe('open');
  });

  it('6. known-bug match, no conflicting evidence -> auto_resolved, "bug", bug wins', () => {
    const signals = [signal({ id: 's1', claim: 'silently drops the last page of results' })];
    const knownBugs = [bug({ id: 'b1', matchHints: ['drops'] })];
    const result = classifyCase({ id: 'c6', topicKey, signals, knownBugs });
    expect(result.status).toBe('auto_resolved');
    expect(result.autoResolution?.decision).toBe('bug');
    expect(result.matchedKnownBugs).toContain('b1');
  });

  it('7. known-bug match + strong "intentional" comment present -> open, conflict populated', () => {
    const signals = [
      signal({
        id: 's1',
        claim: 'silently drops the last page of results',
        affirmativeIntent: {
          kind: 'comment',
          text: '// intentional: pagination caps at 100 by design',
          locator: { file: 'src/routes/users.ts', startLine: 5, endLine: 5 },
          confidence: 0.8
        }
      })
    ];
    const knownBugs = [bug({ id: 'b1', matchHints: ['drops'] })];
    const result = classifyCase({ id: 'c7', topicKey, signals, knownBugs });
    expect(result.status).toBe('open');
    expect(result.conflict?.kind).toBe('known_bug_vs_intentional_evidence');
  });

  it('8. weak/borderline keyword match below INTENT_THRESHOLD -> treated as no intent -> open', () => {
    const signals = [
      signal({ id: 's1', source: 'ingest', claim: 'returns 404 when id is missing' }),
      signal({
        id: 's2',
        source: 'ingest',
        claim: 'returns 404 when id is missing',
        affirmativeIntent: {
          kind: 'comment',
          text: '// hmm, maybe intentional? not sure',
          locator: { file: 'src/routes/users.ts', startLine: 5, endLine: 5 },
          confidence: 0.3
        }
      })
    ];
    const result = classifyCase({ id: 'c8', topicKey, signals, knownBugs: [] });
    expect(result.status).toBe('open');
  });

  it('9. multiple known bugs matching different signals within the same case -> both cited', () => {
    const signals = [
      signal({ id: 's1', claim: 'silently drops the last page of results' }),
      signal({ id: 's2', claim: 'returns stale cached results after an update' })
    ];
    const knownBugs = [bug({ id: 'b1', matchHints: ['drops'] }), bug({ id: 'b2', matchHints: ['stale'] })];
    const result = classifyCase({ id: 'c9', topicKey, signals, knownBugs });
    expect(result.matchedKnownBugs.sort()).toEqual(['b1', 'b2']);
    expect(result.status).toBe('auto_resolved');
  });

  it('10. known bug with no real token overlap does not match, falls through to normal flow', () => {
    const signals = [
      signal({ id: 's1', source: 'ingest', claim: 'returns 404 when id is missing' }),
      signal({ id: 's2', source: 'crawl', claim: 'returns 404 when id is missing' })
    ];
    const knownBugs = [bug({ id: 'b1', matchHints: ['checkout', 'payment'] })];
    const result = classifyCase({ id: 'c10', topicKey, signals, knownBugs });
    expect(result.matchedKnownBugs).toEqual([]);
    expect(result.status).toBe('open'); // falls through to rule 1: silent agreement, no intent
  });
});
