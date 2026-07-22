import { describe, expect, it } from 'vitest';
import { computeUntestedContractFiles } from '../../../src/spec/computeUntestedContractFiles.js';
import type { RouteEntry } from '../../../src/ingest/evidenceSchema.js';

describe('computeUntestedContractFiles', () => {
  it('returns route files with no associated test as untested', () => {
    const routes: RouteEntry[] = [
      { path: '/home', file: 'src/app/home/page.tsx', kind: 'page', startLine: 1 },
      { path: '/letter', file: 'src/app/letter/page.tsx', kind: 'page', startLine: 1 }
    ];
    const untested = computeUntestedContractFiles(routes, ['src/app/home/page.tsx']);
    expect(untested).toEqual(['src/app/letter/page.tsx']);
  });

  it('returns nothing when every route file has an associated test', () => {
    const routes: RouteEntry[] = [{ path: '/home', file: 'src/app/home/page.tsx', kind: 'page', startLine: 1 }];
    expect(computeUntestedContractFiles(routes, ['src/app/home/page.tsx'])).toEqual([]);
  });

  it('does not duplicate a file shared by multiple routes (e.g. GET + POST on the same file)', () => {
    const routes: RouteEntry[] = [
      { path: '/api/users', method: 'GET', file: 'server.ts', kind: 'api', startLine: 3 },
      { path: '/api/users', method: 'POST', file: 'server.ts', kind: 'api', startLine: 10 }
    ];
    expect(computeUntestedContractFiles(routes, [])).toEqual(['server.ts']);
  });

  it('returns an empty array for no routes', () => {
    expect(computeUntestedContractFiles([], [])).toEqual([]);
  });
});
