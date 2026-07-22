import type { AffirmativeIntentKind, Case, KnownBug, Signal } from './types.js';
import { matchKnownBug } from './matchKnownBug.js';
import { structuralAgreement } from './signalDetectors/structuralAgreement.js';

// Conservative on purpose: a missed affirmative-intent signal just becomes
// one more (cheap, safe) human question. A false positive would silently
// auto-resolve something nobody actually decided (expensive) — see the
// non-negotiable rule this whole function exists to enforce below.
const INTENT_THRESHOLD = 0.7;

export interface ClassifyCaseInput {
  id: string;
  topicKey: string;
  signals: Signal[];
  knownBugs: KnownBug[];
}

function findIntent(signals: Signal[], kinds: AffirmativeIntentKind[]) {
  return signals.find(
    (s) => s.affirmativeIntent && kinds.includes(s.affirmativeIntent.kind) && s.affirmativeIntent.confidence >= INTENT_THRESHOLD
  );
}

function findAnyIntent(signals: Signal[]) {
  return signals.find((s) => s.affirmativeIntent && s.affirmativeIntent.confidence >= INTENT_THRESHOLD);
}

export function classifyCase(input: ClassifyCaseInput): Case {
  const { id, topicKey, signals, knownBugs } = input;

  const matchedBugs = knownBugs.filter((bug) => matchKnownBug(bug, signals));

  if (matchedBugs.length > 0) {
    const intentionalEvidence = findIntent(signals, ['comment', 'docstring']);
    if (intentionalEvidence) {
      // NON-NEGOTIABLE: a flagged bug never silently loses to "looks
      // intentional" evidence, no matter how it's worded — always a question.
      return {
        id,
        topicKey,
        signals,
        matchedKnownBugs: matchedBugs.map((b) => b.id),
        status: 'open',
        conflict: {
          kind: 'known_bug_vs_intentional_evidence',
          detail: `Flagged as a known bug (${matchedBugs.map((b) => b.id).join(', ')}) but signal ${intentionalEvidence.id} claims this is intentional: "${intentionalEvidence.affirmativeIntent!.text}"`
        }
      };
    }
    return {
      id,
      topicKey,
      signals,
      matchedKnownBugs: matchedBugs.map((b) => b.id),
      status: 'auto_resolved',
      autoResolution: {
        decision: 'bug',
        reason: `Matches known bug(s): ${matchedBugs.map((b) => b.id).join(', ')}`
      }
    };
  }

  const agree = structuralAgreement(signals);
  const intent = findAnyIntent(signals);

  if (agree && intent) {
    const isBugAdmission = intent.affirmativeIntent!.kind === 'todo' || intent.affirmativeIntent!.kind === 'fixme';
    return {
      id,
      topicKey,
      signals,
      matchedKnownBugs: [],
      status: 'auto_resolved',
      autoResolution: {
        decision: isBugAdmission ? 'bug' : 'intentional',
        reason: `Signals agree; ${intent.id} states: "${intent.affirmativeIntent!.text}"`
      }
    };
  }

  // Anything else — including agreement with zero stated reason — is a
  // question. Silent agreement alone never auto-resolves, no matter how
  // consistent the signals are.
  return {
    id,
    topicKey,
    signals,
    matchedKnownBugs: [],
    status: 'open'
  };
}
