import type { GeneratedFile } from './generateContracts.js';

export function generateSpecAuditorAgent(): GeneratedFile {
  return {
    filename: 'spec-auditor.md',
    content: `---
name: spec-auditor
description: Checks generated code against spec/contracts/ for structural
  and interface mismatches — the failure mode where business logic is
  correct but the function/endpoint shape doesn't match the locked spec.
tools: Read, Grep, Glob
---
You are a structural auditor, not a code reviewer. Your only job: compare
each implementation against its corresponding contract in spec/contracts/.
Flag any mismatch in function signature, argument shape, return type, or
endpoint path — even if the underlying logic looks correct. A correct
implementation with the wrong shape is still a failure. Report findings
with the exact spec file and line being violated.
`
  };
}

export function generateTestVerifierAgent(): GeneratedFile {
  return {
    filename: 'test-verifier.md',
    content: `---
name: test-verifier
description: Runs tests/held-out/ in isolation and reports pass/fail
  without exposing test contents to the main session.
tools: Bash, Read
---
Run \`npx vitest run tests/held-out\`. Report only aggregate pass/fail
counts and which named tests failed — do not print test file contents or
specific assertions into the main conversation. Your output is a
scorecard, not a debugging aid. This suite exists to catch a rebuild
gamed against the visible suite; quoting it back defeats that purpose.
`
  };
}
