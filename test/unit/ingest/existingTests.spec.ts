import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanExistingTests, isTestFile } from '../../../src/ingest/existingTests.js';

describe('isTestFile', () => {
  it('recognizes .spec. and .test. files', () => {
    expect(isTestFile('src/foo.spec.ts')).toBe(true);
    expect(isTestFile('src/foo.test.ts')).toBe(true);
    expect(isTestFile('src/foo.ts')).toBe(false);
  });

  it('recognizes files under a __tests__ directory', () => {
    expect(isTestFile('src/__tests__/foo.ts')).toBe(true);
  });
});

describe('scanExistingTests', () => {
  it('extracts test names and detects the framework from package.json', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-tests-'));
    try {
      const file = join(dir, 'users.spec.ts');
      writeFileSync(
        file,
        [
          "import { describe, it, expect } from 'vitest';",
          "describe('users', () => {",
          "  it('returns 404 when the user does not exist', () => {});",
          "  it('returns 200 with the user payload', () => {});",
          '});'
        ].join('\n')
      );

      const entries = scanExistingTests(dir, [file], {
        scripts: {},
        dependencies: {},
        devDependencies: { vitest: '^4.0.0' }
      });

      expect(entries).toHaveLength(1);
      expect(entries[0]?.framework).toBe('vitest');
      expect(entries[0]?.testNames).toEqual([
        'returns 404 when the user does not exist',
        'returns 200 with the user payload'
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reports "unknown" framework when no recognized test runner is a dependency', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-tests-'));
    try {
      const file = join(dir, 'users.test.ts');
      writeFileSync(file, "test('works', () => {});");

      const entries = scanExistingTests(dir, [file], { scripts: {}, dependencies: {}, devDependencies: {} });

      expect(entries[0]?.framework).toBe('unknown');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
