import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addKnownBug, loadKnownBugs, tokenizeDescription } from '../../../src/state/knownBugs.js';

describe('tokenizeDescription', () => {
  it('derives lowercase word tokens, dropping short/common noise', () => {
    const hints = tokenizeDescription('The users endpoint silently drops the last page of results');
    expect(hints).toContain('users');
    expect(hints).toContain('drops');
    expect(hints).toContain('page');
    expect(hints).not.toContain('the');
    expect(hints).not.toContain('of');
  });
});

describe('known bug store', () => {
  it('appends a bug and persists it to .dossier/known-bugs.json', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-bugs-'));
    try {
      const bug = addKnownBug(dir, 'The users endpoint silently drops the last page of results');

      expect(bug.description).toBe('The users endpoint silently drops the last page of results');
      expect(bug.matchHints.length).toBeGreaterThan(0);

      const loaded = loadKnownBugs(dir);
      expect(loaded).toHaveLength(1);
      expect(loaded[0]?.id).toBe(bug.id);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('appends to existing known bugs rather than overwriting them', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-bugs-'));
    try {
      addKnownBug(dir, 'first bug description here');
      addKnownBug(dir, 'second bug description here');
      expect(loadKnownBugs(dir)).toHaveLength(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns an empty array when no known bugs have been flagged yet', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-bugs-'));
    try {
      expect(loadKnownBugs(dir)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
