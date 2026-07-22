import type { Signal } from '../../reconciliation/types.js';

// A smell detector proactively generates a candidate Signal from a pattern
// nobody commented on and nothing else contradicts — unlike commentSignals
// (which only fires when someone already wrote something down) or route
// detection (which just records structure). Deliberately never attaches an
// affirmativeIntent: a smell is a suspicion, not a stated decision, so it
// must always fall through classifyCase to an open case, never auto-resolve.
export interface SmellDetector {
  name: string;
  detect(repoPath: string, filePaths: string[]): Signal[];
}
