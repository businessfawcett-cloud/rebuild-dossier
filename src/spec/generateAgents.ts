import type { RouteEntry } from '../ingest/evidenceSchema.js';
import { contractFilename, type GeneratedFile } from './generateContracts.js';

function contractChecklist(routes: RouteEntry[]): string {
  return routes
    .map((route) => {
      const title = route.method ? `${route.method} ${route.path}` : route.path;
      return `- ${title} — spec/contracts/${contractFilename(route.method, route.path)} ↔ \`${route.file}\``;
    })
    .join('\n');
}

// Lists this project's actual contracts rather than telling the agent to go
// rediscover spec/contracts/ itself — a fixed checklist is harder to skim
// past than an open-ended instruction, and it's the same audit every time
// regardless of which model is running it.
export function generateSpecAuditorAgent(routes: RouteEntry[]): GeneratedFile | null {
  if (routes.length === 0) return null;

  return {
    filename: 'spec-auditor.md',
    content: `---
name: spec-auditor
description: Checks generated code against this project's locked contracts
  for structural and interface mismatches — the failure mode where business
  logic is correct but the function/endpoint shape doesn't match the spec.
tools: Read, Grep, Glob
---
You are a structural auditor, not a code reviewer. Check exactly these
contracts against their current implementation — nothing more, nothing less:

${contractChecklist(routes)}

For each one, flag any mismatch in function signature, argument shape,
return type, or endpoint path — even if the underlying logic looks correct.
A correct implementation with the wrong shape is still a failure. Report
findings with the exact spec file being violated.
`
  };
}

// Skipped entirely when this project has no held-out tests — an agent whose
// only job is "run an empty suite" is dead weight, not a safety net.
export function generateTestVerifierAgent(heldOutFilenames: string[]): GeneratedFile | null {
  if (heldOutFilenames.length === 0) return null;

  const list = heldOutFilenames.map((f) => `- ${f}`).join('\n');

  return {
    filename: 'test-verifier.md',
    content: `---
name: test-verifier
description: Runs this project's tests/held-out/ suite in isolation and
  reports pass/fail without exposing test contents to the main session.
tools: Bash, Read
---
Run \`npx vitest run tests/held-out\`. This project's held-out suite is
exactly these ${heldOutFilenames.length} file(s), never shown to the rebuild
agent until this point:

${list}

Report only aggregate pass/fail counts and which named tests failed — do
not print test file contents or specific assertions into the main
conversation. Your output is a scorecard, not a debugging aid.
`
  };
}
