import type { Case } from './types.js';
import { loadCases, saveCases } from '../state/caseStore.js';

// Shared by both the get_case_queue (elicitation) and resolve_case (scripted)
// paths so there is exactly one code path that writes a human decision,
// regardless of which channel it arrived through.
export function resolveCaseInternal(
  repoPath: string,
  id: string,
  decision: string,
  note: string | undefined,
  via: 'elicitation' | 'resolve_case_tool'
): Case | null {
  const cases = loadCases(repoPath);
  const index = cases.findIndex((c) => c.id === id);
  if (index === -1) {
    return null;
  }

  const resolved: Case = {
    ...cases[index]!,
    status: 'resolved_by_human',
    humanDecision: { decision, note, decidedAt: new Date().toISOString(), via }
  };
  cases[index] = resolved;
  saveCases(repoPath, cases);
  return resolved;
}
