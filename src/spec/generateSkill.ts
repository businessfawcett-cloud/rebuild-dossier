import type { GeneratedFile } from './generateContracts.js';

// A manual checkpoint beyond the automatic hooks: invoke mid-session
// (/verify-against-spec) to re-check the current implementation against
// spec/contracts/ and re-run tests/visible/ in one step, without touching
// tests/held-out/ — the hooks already run tests after every edit, but don't
// check contract *shape* independent of test pass/fail.
export function generateVerifyAgainstSpecSkill(): GeneratedFile {
  return {
    filename: 'verify-against-spec/SKILL.md',
    content: `---
description: Re-checks the current implementation against spec/contracts/ for
  structural mismatches, then re-runs the full tests/visible/ suite — a manual
  checkpoint beyond the automatic hooks. Use after a batch of changes, or
  whenever you want to confirm nothing has silently drifted from the locked
  spec.
---
1. Read every file in spec/contracts/.
2. For each contract, find its corresponding implementation and confirm the
   function/endpoint shape matches exactly: signature, argument shape, return
   type, endpoint path. Flag any mismatch, even if the underlying logic looks
   correct — a correct implementation with the wrong shape still fails
   verification.
3. Run the full tests/visible/ suite.
4. Report contract conformance (pass/fail per contract) and the suite's
   pass/fail counts. Do not touch, run, or reference tests/held-out/.
`
  };
}
