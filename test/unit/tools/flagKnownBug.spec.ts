import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { flagKnownBugHandler } from '../../../src/tools/flagKnownBug.js';
import { loadKnownBugs } from '../../../src/state/knownBugs.js';

describe('flag_known_bug tool', () => {
  it('persists the bug verbatim and reports it back', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-flagtool-'));
    try {
      const result = await flagKnownBugHandler({
        repoPath: dir,
        description: 'The users endpoint silently drops the last page of results'
      });

      const bugs = loadKnownBugs(dir);
      expect(bugs).toHaveLength(1);
      expect(bugs[0]?.description).toBe('The users endpoint silently drops the last page of results');

      const text = result.content[0]?.text ?? '';
      expect(text).toContain('The users endpoint silently drops the last page of results');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
