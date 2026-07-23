import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ingestRepoHandler } from '../../../src/tools/ingestRepo.js';
import { flagKnownBugHandler } from '../../../src/tools/flagKnownBug.js';
import { loadCases } from '../../../src/state/caseStore.js';

// classifyCase's known_bug_vs_intentional_evidence branch already has full
// hand-fixture coverage (Signal objects built directly in test code) — that
// proves the logic is correct. What's never been exercised is the wiring in
// front of it: does a REAL comment, scanned from a REAL file by
// extractCommentSignals/detectIntentionalComment, and a REAL known bug,
// matched by matchKnownBug's actual token-overlap logic (not hand-picked
// hints), actually produce a Signal shaped the way classifyCase expects when
// a genuine disagreement exists? Neither of the two real validation runs
// (Madeline, catchandtrade) ever had a comment signal at all, so this path
// has never fired outside of hand-built fixtures. This closes the mechanism
// question — it does not prove real-world comment phrasing (sarcastic,
// stale, hedged, misplaced) won't trip up the detectors in ways no fixture
// anticipated; that's a real-world-messiness question, deliberately left
// open and backlogged rather than answered here.
describe('reconciliation wiring: a real comment signal vs a real known-bug match', () => {
  it('surfaces a known_bug_vs_intentional_evidence conflict end-to-end, through real extraction and real matching', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-realconflict-'));
    try {
      writeFileSync(
        join(dir, 'listings.ts'),
        [
          '// This function intentionally allows empty search queries — an empty',
          '// query is treated as "browse all", not an error.',
          'export function searchListings(query: string) {',
          '  if (query.length === 0) {',
          "    return { results: 'all' };",
          '  }',
          "  return { results: 'filtered' };",
          '}'
        ].join('\n')
      );

      await ingestRepoHandler({ path: dir });
      await flagKnownBugHandler({
        repoPath: dir,
        description: 'Search queries that are empty silently return all results instead of an error'
      });

      const cases = loadCases(dir);

      expect(cases).toHaveLength(1);
      const kase = cases[0]!;
      expect(kase.status).toBe('open');
      expect(kase.conflict?.kind).toBe('known_bug_vs_intentional_evidence');
      expect(kase.matchedKnownBugs.length).toBeGreaterThan(0);
      // Confirms the intentional-comment signal really was extracted from
      // the file by the real detector, not present because of a fixture.
      expect(kase.signals.some((s) => s.source === 'ingest' && s.affirmativeIntent?.kind === 'comment')).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('control: without the known bug, the same intentional comment auto-resolves cleanly (no conflict)', async () => {
    // Isolates that the conflict above comes from the known-bug match
    // specifically, not from some other quirk of this fixture file.
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-realconflict-control-'));
    try {
      writeFileSync(
        join(dir, 'listings.ts'),
        [
          '// This function intentionally allows empty search queries — an empty',
          '// query is treated as "browse all", not an error.',
          'export function searchListings(query: string) {',
          '  if (query.length === 0) {',
          "    return { results: 'all' };",
          '  }',
          "  return { results: 'filtered' };",
          '}'
        ].join('\n')
      );

      await ingestRepoHandler({ path: dir });

      const cases = loadCases(dir);
      expect(cases).toHaveLength(1);
      expect(cases[0]?.conflict).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
