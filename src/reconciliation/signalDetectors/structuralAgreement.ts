import type { Signal } from '../types.js';

function normalize(claim: string): string {
  return claim.trim().toLowerCase();
}

// Exact-match boolean for v0 (no fuzzy confidence score) so classifyCase stays
// fully deterministic and testable without calibration data. A single signal
// has nothing to agree with, so it never counts as agreement on its own.
export function structuralAgreement(signals: Signal[]): boolean {
  if (signals.length < 2) {
    return false;
  }
  const [first, ...rest] = signals;
  const normalizedFirst = normalize(first!.claim);
  return rest.every((signal) => normalize(signal.claim) === normalizedFirst);
}
