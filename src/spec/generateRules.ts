import type { GeneratedFile } from './generateContracts.js';

export function generateTestingRule(testCommand: string): GeneratedFile {
  return {
    filename: 'testing.md',
    content: `# Testing conventions

- Run \`${testCommand}\` to check the visible suite. A PostToolUse hook
  already runs it after every edit — this is for manual checks.
- Work test-by-test: pick one failing test, make the smallest change
  that could pass it, then re-run the FULL tests/visible/ suite before
  moving to the next.
- tests/held-out/ exists to catch tests gamed against tests/visible/.
  Do not read, reference, or run it until every visible test passes.
  Run it once, at the end, as a final report — never iterate against it.
- A test flagged "weak" (in tests/weak/, if present) failed a mutation
  check during generation: it didn't catch a deliberately introduced
  bug in the original code. Treat it as informational, not a target.
`
  };
}
