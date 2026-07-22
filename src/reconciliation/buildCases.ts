import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Case, KnownBug, Signal, Locator } from './types.js';
import { classifyCase } from './classifyCase.js';
import { matchKnownBug } from './matchKnownBug.js';
import { findNearDuplicateGroups } from './nearDuplicateComponents.js';
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

function isCodeLocator(locator: Locator): locator is { file: string; startLine: number; endLine: number } {
  return 'file' in locator;
}

function primaryFileFor(kase: Case): string | null {
  const signal = kase.signals.find((s) => isCodeLocator(s.locator));
  return signal && isCodeLocator(signal.locator) ? signal.locator.file : null;
}

// Cross-references cases whose source file is a near-content-duplicate of
// another case's — see nearDuplicateComponents.ts for why this matters (three
// gate variants in the real Madeline validation each got their own
// disconnected case, and nothing signaled they might be the same decision).
// Runs over every case's file, including already-resolved ones, since seeing
// "this decision may apply to N similar files" is still useful context even
// after a decision has been made.
function attachNearDuplicateCrossReferences(repoPath: string, cases: Case[]): void {
  const candidates: { path: string; content: string; caseId: string }[] = [];
  for (const kase of cases) {
    const file = primaryFileFor(kase);
    if (!file) continue;
    const fullPath = join(repoPath, file);
    if (!existsSync(fullPath)) continue;
    try {
      candidates.push({ path: file, content: readFileSync(fullPath, 'utf-8'), caseId: kase.id });
    } catch {
      // unreadable — skip rather than fail the whole case-build over one file
    }
  }
  if (candidates.length < 2) return;

  const fileToCaseId = new Map(candidates.map((c) => [c.path, c.caseId]));
  const groups = findNearDuplicateGroups(candidates.map(({ path, content }) => ({ path, content })));

  const caseById = new Map(cases.map((c) => [c.id, c]));
  for (const group of groups) {
    const caseIds = group.map((file) => fileToCaseId.get(file)).filter((id): id is string => Boolean(id));
    for (const caseId of caseIds) {
      caseById.get(caseId)!.relatedCaseIds = caseIds.filter((id) => id !== caseId);
    }
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

  attachNearDuplicateCrossReferences(repoPath, cases);

  saveCases(repoPath, cases);
  return cases;
}
