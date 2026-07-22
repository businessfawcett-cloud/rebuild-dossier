import type { Case, KnownBug, Signal } from './types.js';
import { classifyCase } from './classifyCase.js';
import { matchKnownBug } from './matchKnownBug.js';
import { loadEvidenceBundle, loadCrawlEvidence } from '../state/evidenceStore.js';
import { loadKnownBugs } from '../state/knownBugs.js';
import { loadCases, saveCases } from '../state/caseStore.js';

function groupByTopicKey(signals: Signal[]): Map<string, Signal[]> {
  const groups = new Map<string, Signal[]>();
  for (const signal of signals) {
    const group = groups.get(signal.topicKey);
    if (group) {
      group.push(signal);
    } else {
      groups.set(signal.topicKey, [signal]);
    }
  }
  return groups;
}

// A known bug is the cheapest, most authoritative signal in the whole system
// — flag_known_bug's contract is that it "always overrides auto-resolve,
// regardless of confidence." That guarantee is void if the bug simply has
// nothing to attach to: seed a synthetic case, built from the bug's own
// description, for any bug that doesn't already match a real signal-based
// group. Without this, a flagged bug in an otherwise-uncommented file would
// silently vanish instead of surfacing — worse than the silent-agreement
// failure mode this tool exists to catch.
function seedOrphanedKnownBugGroups(grouped: Map<string, Signal[]>, knownBugs: KnownBug[]): void {
  for (const bug of knownBugs) {
    const alreadyCovered = [...grouped.values()].some((signals) => matchKnownBug(bug, signals));
    if (alreadyCovered) continue;

    const topicKey = `known-bug:${bug.id}`;
    grouped.set(topicKey, [
      {
        id: `known-bug-signal:${bug.id}`,
        source: 'known_bug',
        locator: { path: 'unknown' },
        topicKey,
        claim: bug.description,
        evidenceText: bug.description,
        detectedAt: bug.flaggedAt
      }
    ]);
  }
}

// Re-derives cases from current evidence + known bugs, but a case a human
// already resolved is never silently overwritten by a fresh auto-classification
// — re-running ingest_repo/crawl_site must not discard a decision someone made.
export function buildCases(repoPath: string): Case[] {
  const evidence = loadEvidenceBundle(repoPath);
  const crawl = loadCrawlEvidence(repoPath);
  const knownBugs = loadKnownBugs(repoPath);

  const allSignals = [...(evidence?.signals ?? []), ...(crawl?.signals ?? [])];
  const grouped = groupByTopicKey(allSignals);
  seedOrphanedKnownBugGroups(grouped, knownBugs);

  const existingById = new Map(loadCases(repoPath).map((c) => [c.id, c]));

  const cases: Case[] = [];
  for (const [topicKey, signals] of grouped) {
    const id = `case:${topicKey}`;
    const existing = existingById.get(id);
    if (existing?.status === 'resolved_by_human') {
      cases.push(existing);
      continue;
    }
    cases.push(classifyCase({ id, topicKey, signals, knownBugs }));
  }

  saveCases(repoPath, cases);
  return cases;
}
