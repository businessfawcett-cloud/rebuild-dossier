import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { atomicWriteFile } from '../../../src/state/atomicWrite.js';

describe('atomicWriteFile', () => {
  it('writes the given content to the target file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-atomic-'));
    try {
      const target = join(dir, 'evidence.json');
      atomicWriteFile(target, '{"ok":true}');
      expect(readFileSync(target, 'utf-8')).toBe('{"ok":true}');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('creates parent directories that do not yet exist', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-atomic-'));
    try {
      const target = join(dir, 'nested', 'deeper', 'evidence.json');
      atomicWriteFile(target, 'hello');
      expect(readFileSync(target, 'utf-8')).toBe('hello');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('leaves no leftover temp files behind', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-atomic-'));
    try {
      atomicWriteFile(join(dir, 'evidence.json'), 'content');
      const entries = readdirSync(dir);
      expect(entries).toEqual(['evidence.json']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('overwrites an existing file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-atomic-'));
    try {
      const target = join(dir, 'evidence.json');
      atomicWriteFile(target, 'first');
      atomicWriteFile(target, 'second');
      expect(readFileSync(target, 'utf-8')).toBe('second');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
