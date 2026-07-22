import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { tsMorphEngine } from '../../../src/mutation/tsMorphEngine.js';

describe('tsMorphEngine', () => {
  it('enumerates sites from all registered mutators for a real file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-engine-'));
    try {
      const file = join(dir, 'code.ts');
      writeFileSync(file, 'if (!user) { return 404; }\nfor (let i = 0; i < arr.length; i++) {}\n');

      const sites = tsMorphEngine.enumerateSites(file, 'code.ts');

      expect(sites.some((s) => s.mutatorName === 'drop-null-check')).toBe(true);
      expect(sites.some((s) => s.mutatorName === 'off-by-one-loop-bound')).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('applies a mutation and persists it to disk', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-engine-'));
    try {
      const file = join(dir, 'code.ts');
      writeFileSync(file, 'if (!user) { return 404; }\n');

      const [site] = tsMorphEngine.enumerateSites(file, 'code.ts');
      const applied = tsMorphEngine.apply(file, site!);

      expect(applied).toBe(true);
      expect(readFileSync(file, 'utf-8')).toContain('if (user) { return 404; }');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns false for an unknown mutator name', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-engine-'));
    try {
      const file = join(dir, 'code.ts');
      writeFileSync(file, 'if (!user) {}\n');
      const applied = tsMorphEngine.apply(file, {
        mutatorName: 'not-a-real-mutator',
        locator: { file: 'code.ts', startLine: 1, endLine: 1 },
        description: '',
        occurrenceIndex: 0
      });
      expect(applied).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
