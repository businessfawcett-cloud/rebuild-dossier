import type { RouteEntry } from '../ingest/evidenceSchema.js';

// A locked contract with no test behind it is exactly the gap the Haiku
// handoff fell through: nothing enforces "only build what's currently
// failing" except a sentence in the kickoff prompt, so a model that weighs
// prose less heavily can batch-build every contract in spec/ and still pass
// every test, because no test ever looks at the extra files. This list is
// what the generated PreToolUse hook checks against to make that rule
// mechanically enforced instead of advisory.
export function computeUntestedContractFiles(routes: RouteEntry[], testedSourceFiles: string[]): string[] {
  const tested = new Set(testedSourceFiles);
  const untested = new Set<string>();
  for (const route of routes) {
    if (!tested.has(route.file)) {
      untested.add(route.file);
    }
  }
  return [...untested];
}
