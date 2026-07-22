import { describe, expect, it } from 'vitest';
import { signalSchema, knownBugSchema, caseSchema } from '../../../src/reconciliation/types.js';

describe('reconciliation/types schemas', () => {
  it('accepts a bare signal with no affirmative intent', () => {
    const signal = {
      id: 'sig-1',
      source: 'crawl',
      locator: { path: '/api/users', method: 'GET' },
      topicKey: 'route:GET:/api/users',
      claim: 'returns 200 with an empty array when no users exist',
      evidenceText: 'observed response body: []',
      detectedAt: new Date(0).toISOString()
    };
    expect(() => signalSchema.parse(signal)).not.toThrow();
  });

  it('rejects a signal missing topicKey', () => {
    const signal = {
      id: 'sig-1',
      source: 'crawl',
      locator: { path: '/api/users', method: 'GET' },
      claim: 'returns 200',
      evidenceText: 'observed',
      detectedAt: new Date(0).toISOString()
    };
    expect(() => signalSchema.parse(signal)).toThrow();
  });

  it('accepts a known bug with derived match hints', () => {
    const bug = {
      id: 'bug-1',
      description: 'The users endpoint silently drops the last page of results',
      matchHints: ['users', 'pagination'],
      flaggedAt: new Date(0).toISOString()
    };
    expect(() => knownBugSchema.parse(bug)).not.toThrow();
  });

  it('accepts an open case with a conflict record', () => {
    const kase = {
      id: 'case-1',
      topicKey: 'route:GET:/api/users',
      signals: [],
      matchedKnownBugs: ['bug-1'],
      status: 'open',
      conflict: {
        kind: 'known_bug_vs_intentional_evidence',
        detail: 'flagged as a bug, but a comment claims this is intentional'
      }
    };
    expect(() => caseSchema.parse(kase)).not.toThrow();
  });
});
