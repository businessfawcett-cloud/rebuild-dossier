import { describe, expect, it } from 'vitest';
import {
  concretePath,
  parseExpectedStatus,
  reconciliationAssertion,
  sanitizeFilenameBase
} from '../../../src/spec/routeTestAssertions.js';
import type { RouteEntry } from '../../../src/ingest/evidenceSchema.js';
import type { Case } from '../../../src/reconciliation/types.js';

const now = new Date(0).toISOString();

describe('concretePath', () => {
  it('replaces every dynamic segment with a concrete placeholder value', () => {
    expect(concretePath('/api/users/:id')).toBe('/api/users/test-value-123');
    expect(concretePath('/api/orgs/:orgId/users/:userId')).toBe('/api/orgs/test-value-123/users/test-value-123');
    expect(concretePath('/api/health')).toBe('/api/health');
  });
});

describe('parseExpectedStatus', () => {
  it('extracts a 3-digit HTTP status code from a claim', () => {
    expect(parseExpectedStatus('returns 404 when the user does not exist')).toBe(404);
    expect(parseExpectedStatus('should be a 201 on creation')).toBe(201);
  });

  it('returns null when no status code is present', () => {
    expect(parseExpectedStatus('does something')).toBeNull();
  });
});

describe('reconciliationAssertion', () => {
  const route: RouteEntry = { path: '/api/users/:id', method: 'GET', file: 'server.ts', kind: 'api', startLine: 6 };

  it('returns a claim+status when a case is resolved as intentional and states a status', () => {
    const cases: Case[] = [
      {
        id: 'case:route:GET:/api/users/:id',
        topicKey: 'route:GET:/api/users/:id',
        signals: [
          {
            id: 's1',
            source: 'ingest',
            locator: { file: 'server.ts', startLine: 6, endLine: 6 },
            topicKey: 'route:GET:/api/users/:id',
            claim: 'returns 404 when the user does not exist',
            evidenceText: 'e',
            detectedAt: now
          }
        ],
        matchedKnownBugs: [],
        status: 'auto_resolved',
        autoResolution: { decision: 'intentional', reason: 'r' }
      }
    ];
    expect(reconciliationAssertion(route, cases)).toEqual({ claim: 'returns 404 when the user does not exist', status: 404 });
  });

  it('returns null for a case resolved as a bug (correct fixed value unknown)', () => {
    const cases: Case[] = [
      {
        id: 'case:route:GET:/api/users/:id',
        topicKey: 'route:GET:/api/users/:id',
        signals: [
          {
            id: 's1',
            source: 'ingest',
            locator: { file: 'server.ts', startLine: 6, endLine: 6 },
            topicKey: 'route:GET:/api/users/:id',
            claim: 'returns 404 when the user does not exist',
            evidenceText: 'e',
            detectedAt: now
          }
        ],
        matchedKnownBugs: ['bug-1'],
        status: 'auto_resolved',
        autoResolution: { decision: 'bug', reason: 'r' }
      }
    ];
    expect(reconciliationAssertion(route, cases)).toBeNull();
  });

  it('returns null when no case matches this route at all', () => {
    expect(reconciliationAssertion(route, [])).toBeNull();
  });
});

describe('sanitizeFilenameBase', () => {
  it('builds a filesystem-safe base name from method + path', () => {
    expect(sanitizeFilenameBase('GET', '/api/users/:id')).toBe('GET-api-users-id');
    expect(sanitizeFilenameBase(undefined, '/')).toBe('PAGE-root');
  });
});
