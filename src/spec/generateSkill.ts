import type { RouteEntry } from '../ingest/evidenceSchema.js';
import { contractFilename, type GeneratedFile } from './generateContracts.js';

// A manual checkpoint beyond the automatic hooks: invoke mid-session
// (/verify-against-spec) to re-check the current implementation against
// this project's actual contracts and re-run tests/visible/ in one step,
// without touching tests/held-out/ — the hooks already run tests after
// every edit, but don't check contract *shape* independent of pass/fail.
export function generateVerifyAgainstSpecSkill(routes: RouteEntry[]): GeneratedFile | null {
  if (routes.length === 0) return null;

  const checklist = routes
    .map((route) => {
      const title = route.method ? `${route.method} ${route.path}` : route.path;
      return `- [ ] ${title} — spec/contracts/${contractFilename(route.method, route.path)} ↔ \`${route.file}\``;
    })
    .join('\n');

  return {
    filename: 'verify-against-spec/SKILL.md',
    content: `---
description: Re-checks the current implementation against this project's
  locked contracts for structural mismatches, then re-runs the full
  tests/visible/ suite — a manual checkpoint beyond the automatic hooks. Use
  after a batch of changes, or whenever you want to confirm nothing has
  silently drifted from the locked spec.
---
Check exactly these contracts against their current implementation:

${checklist}

For each one, confirm the function/endpoint shape matches exactly:
signature, argument shape, return type, endpoint path. Flag any mismatch,
even if the underlying logic looks correct — a correct implementation with
the wrong shape still fails verification.

Then run the full tests/visible/ suite.

Report contract conformance (pass/fail per contract above) and the suite's
pass/fail counts. Do not touch, run, or reference tests/held-out/.
`
  };
}
