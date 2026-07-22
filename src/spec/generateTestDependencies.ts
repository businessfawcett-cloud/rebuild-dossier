import type { GeneratedTestFile } from './generateTests.js';

export interface TestPlacement {
  file: GeneratedTestFile;
  dir: 'visible' | 'held-out' | 'weak';
}

// Cheap, mechanical static analysis (no LLM) so any orchestrator — human,
// Claude Code subagents, whatever — can cluster tests that share a file
// (must run serially / same subagent) versus tests on disjoint files (safe
// to run in parallel). Reflects each test's ACTUAL final directory, since
// the mutation check can downgrade a test to tests/weak/ after generation.
export function generateTestDependencies(placements: TestPlacement[]): Record<string, string[]> {
  const deps: Record<string, string[]> = {};
  for (const { file, dir } of placements) {
    deps[`tests/${dir}/${file.filename}`] = file.coveredRouteFiles ?? [file.sourceFile];
  }
  return deps;
}
