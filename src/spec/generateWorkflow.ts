import type { GeneratedFile } from './generateContracts.js';

export function generateParallelTestFixWorkflow(): GeneratedFile {
  return {
    filename: 'parallel-test-fix.js',
    content: `export const meta = {
  name: 'parallel-test-fix',
  description:
    'Cluster failing tests/visible/ tests by shared source files (from spec/test-dependencies.json), fix each cluster in an isolated worktree, merge, then re-run the full suite once to catch cross-cluster regressions.',
  phases: [{ title: 'Cluster' }, { title: 'Fix' }, { title: 'Merge & verify' }]
}

// A suggested strategy, not a required path — the same red-green-refactor
// discipline in kickoff-prompt.txt applies whether you run this or just work
// serially. Only worth using when there are enough failing tests, on
// genuinely disjoint files, that parallelizing saves real time.

phase('Cluster')
await agent(
  'If this directory is not yet a git repository, run "git init" and commit the current state. Report done.',
  { phase: 'Cluster' }
)
const clustering = await agent(
  'Read spec/test-dependencies.json and run the full tests/visible/ suite. Report which named tests are currently failing, and for each one, which source files it depends on per test-dependencies.json. Group failing tests into clusters: tests sharing at least one source file go in the same cluster; tests on fully disjoint files may go in separate clusters.',
  {
    phase: 'Cluster',
    schema: {
      type: 'object',
      required: ['clusters'],
      properties: {
        clusters: {
          type: 'array',
          items: {
            type: 'object',
            required: ['tests', 'files'],
            properties: {
              tests: { type: 'array', items: { type: 'string' } },
              files: { type: 'array', items: { type: 'string' } }
            }
          }
        }
      }
    }
  }
)

if (clustering.clusters.length === 0) {
  log('No failing tests found in tests/visible/ — nothing to fix.')
} else {
  phase('Fix')
  await parallel(
    clustering.clusters.map((cluster, i) => () =>
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

return { clustering }
`
  };
}
