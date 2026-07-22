import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractCommentSignals } from '../../../src/ingest/commentSignals.js';

describe('extractCommentSignals', () => {
  it('extracts a TODO comment as a signal with affirmative intent', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-comments-'));
    try {
      const file = join(dir, 'users.ts');
      writeFileSync(
        file,
        [
          'export function getUser(id?: string) {',
          '  if (!id) {',
          '    // TODO: this should be a 400, not a 404',
          '    return { status: 404 };',
          '  }',
          '  return { status: 200 };',
          '}'
        ].join('\n')
      );

      const signals = extractCommentSignals(dir, [file]);

      expect(signals).toHaveLength(1);
      expect(signals[0]?.affirmativeIntent?.kind).toBe('todo');
      expect(signals[0]?.locator).toMatchObject({ file: 'users.ts' });
      expect(signals[0]?.source).toBe('ingest');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('extracts a docstring comment stating intent, tagged as docstring', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-comments-'));
    try {
      const file = join(dir, 'users.ts');
      writeFileSync(
        file,
        [
          '/**',
          ' * Returns duplicates intentionally to preserve insertion order.',
          ' */',
          'export function listUsers() {',
          '  return [];',
          '}'
        ].join('\n')
      );

      const signals = extractCommentSignals(dir, [file]);

      expect(signals).toHaveLength(1);
      expect(signals[0]?.affirmativeIntent?.kind).toBe('docstring');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('ignores plain descriptive comments with no affirmative intent', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-comments-'));
    try {
      const file = join(dir, 'users.ts');
      writeFileSync(file, ['// fetch the user by id', 'export function getUser(id: string) {', '  return id;', '}'].join('\n'));

      const signals = extractCommentSignals(dir, [file]);

      expect(signals).toHaveLength(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
