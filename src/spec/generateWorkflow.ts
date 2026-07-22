import type { GeneratedFile } from './generateContracts.js';
import type { TestCluster } from './clusterTests.js';

// Only worth generating when there's genuinely more than one cluster to
// parallelize across — a single cluster (however many tests share its
// files) has to run serially regardless, so a "parallel fix" workflow adds
// nothing over just working through it directly.
export function generateParallelTestFixWorkflow(clusters: TestCluster[]): GeneratedFile | null {
  if (clusters.length < 2) return null;

  const clustersLiteral = JSON.stringify(clusters, null, 2);

  return {
    filename: 'parallel-test-fix.js',
    content: `export const meta = {
  name: 'parallel-test-fix',
  description:
    'Fix this project\\'s currently-failing tests/visible/ tests, clustered by shared source files (precomputed from spec/test-dependencies.json at generation time), each cluster in its own isolated worktree, then merge and re-run the full suite once to catch cross-cluster regressions.',
  phases: [{ title: 'Check status' }, { title: 'Fix' }, { title: 'Merge & verify' }]
}

// This project's actual test/file clusters, computed once at generate_spec
// time from spec/test-dependencies.json — not rediscovered here, so there's
// no extra LLM round-trip that could get the clustering wrong.
const clusters = ${clustersLiteral}

phase('Check status')
await agent(
  'If this directory is not yet a git repository, run "git init" and commit the current state. Report done.',
  { phase: 'Check status' }
)
const allTests = clusters.flatMap((c) => c.tests)
const status = await agent(
  \`Run the full tests/visible/ suite. Report which of these specific tests are currently failing: \${allTests.join(', ')}.\`,
  {
    phase: 'Check status',
    schema: { type: 'object', required: ['failingTests'], properties: { failingTests: { type: 'array', items: { type: 'string' } } } }
  }
)

const failingClusters = clusters
  .map((c) => ({ ...c, tests: c.tests.filter((t) => status.failingTests.includes(t)) }))
  .filter((c) => c.tests.length > 0)

if (failingClusters.length === 0) {
  log('All tests in tests/visible/ are already passing — nothing to fix.')
} else if (failingClusters.length === 1) {
  log('Only one cluster has failing tests right now — nothing to parallelize; fix it directly rather than through this workflow.')
} else {
  phase('Fix')
  await parallel(
    failingClusters.map((cluster, i) => () =>
      agent(
        \`Work ONLY on these currently-failing tests: \${cluster.tests.join(', ')}. You may only touch these files: \${cluster.files.join(', ')}. Fix one test at a time, smallest possible change, re-running this cluster's own tests after each fix before moving to the next. Do not touch any file outside this list — another agent may be editing a different cluster concurrently in its own worktree.\`,
        { label: \`cluster-\${i}\`, phase: 'Fix', isolation: 'worktree' }
      )
    )
  )

  phase('Merge & verify')
  const finalReport = await agent(
    "Merge all worktree branches from the parallel fix phase back into the main branch, resolving any conflicts. Then run the FULL tests/visible/ suite once — not just each cluster's own tests, to catch cross-cluster regressions the isolated subagents could not see. If anything is now failing that wasn't part of any cluster's assignment, that's a regression: fix it with a single serial change, not another parallel wave, since diagnosing a cross-file regression needs the shared state parallel isolation throws away. Report final tests/visible/ pass/fail counts. Do NOT run tests/held-out/ — that happens once, manually, only after every visible test passes.",
    { phase: 'Merge & verify' }
  )
  log(finalReport)
}

return { clusters, failingClusters }
`
  };
}
