import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateContracts } from '../../../src/spec/generateContracts.js';
import type { RouteEntry } from '../../../src/ingest/evidenceSchema.js';

describe('generateContracts', () => {
  it('produces one contract file per route with the verbatim source line, not a paraphrase', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-contracts-'));
    try {
      writeFileSync(
        join(dir, 'server.ts'),
        ["import express from 'express';", '', "app.get('/api/users/:id', (req, res) => {});"].join('\n')
      );
      const routes: RouteEntry[] = [{ path: '/api/users/:id', method: 'GET', file: 'server.ts', kind: 'api', startLine: 3 }];

      const files = generateContracts(dir, routes);

      expect(files).toHaveLength(1);
      expect(files[0]?.filename).toBe('GET-api-users-id.md');
      expect(files[0]?.content).toContain('/api/users/:id');
      expect(files[0]?.content).toContain("app.get('/api/users/:id', (req, res) => {});");
      expect(files[0]?.content).toContain('server.ts');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('sanitizes page routes with no method into a distinct filename', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-contracts-'));
    try {
      writeFileSync(join(dir, 'page.tsx'), 'export default function About() { return null; }');
      const routes: RouteEntry[] = [{ path: '/about', file: 'page.tsx', kind: 'page', startLine: 1 }];

      const files = generateContracts(dir, routes);

      expect(files[0]?.filename).toBe('PAGE-about.md');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns an empty array for no routes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-contracts-'));
    try {
      expect(generateContracts(dir, [])).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
