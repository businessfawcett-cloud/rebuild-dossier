import type { GeneratedTestFile } from './generateTests.js';

export interface TestCluster {
  tests: string[];
  files: string[];
}

// Cheap, mechanical static analysis (no LLM) — tests sharing at least one
// covered route file must run serially (same subagent / same worktree);
// tests on fully disjoint files are safe to fix in parallel. Baking the
// actual answer into generated artifacts, rather than having an agent
// rediscover clustering from spec/test-dependencies.json at runtime, means
// one less LLM round-trip that could get it wrong.
export function clusterTestsByFile(tests: GeneratedTestFile[]): TestCluster[] {
  const parent = new Map<string, string>();

  function find(x: string): string {
    let root = x;
    while (parent.get(root) !== undefined && parent.get(root) !== root) {
      root = parent.get(root)!;
    }
    return root;
  }

  function union(a: string, b: string): void {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) {
      parent.set(rootA, rootB);
    }
  }

  const fileToTests = new Map<string, Set<string>>();
  for (const test of tests) {
    parent.set(test.filename, test.filename);
    const routeFiles = test.coveredRouteFiles ?? [test.sourceFile];
    for (const routeFile of routeFiles) {
      if (!fileToTests.has(routeFile)) {
        fileToTests.set(routeFile, new Set());
      }
      fileToTests.get(routeFile)!.add(test.filename);
    }
  }

  for (const testsSharingFile of fileToTests.values()) {
    const [first, ...rest] = [...testsSharingFile];
    for (const other of rest) {
      union(first!, other);
    }
  }

  const groups = new Map<string, { tests: Set<string>; files: Set<string> }>();
  for (const test of tests) {
    const root = find(test.filename);
    if (!groups.has(root)) {
      groups.set(root, { tests: new Set(), files: new Set() });
    }
    const group = groups.get(root)!;
    group.tests.add(test.filename);
    for (const routeFile of test.coveredRouteFiles ?? [test.sourceFile]) {
      group.files.add(routeFile);
    }
  }

  return [...groups.values()].map((g) => ({ tests: [...g.tests], files: [...g.files] }));
}
