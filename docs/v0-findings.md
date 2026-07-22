# rebuild-dossier v0: findings

**Status:** v0 built (6 MCP tools, ~160 unit tests), validated end-to-end against one real
repo, with two independent fresh-agent handoffs on two model tiers. This document is the
honest result — including the failures — not a feature list.

## The hypothesis being tested

Prior research (AgentModernize, arXiv:2605.17535) found a rebuild pipeline scores 0%
behavioral equivalence with no verified feedback loop, 9–19% with a coarse one. The bet
behind this build: locking interface contracts before running tests, plus a strict
one-test-at-a-time retry loop (never batch regeneration), does meaningfully better. v0's only
job was finding out, on one small real example, before building anything further.

## The target

[businessfawcett-cloud/Madeline](https://github.com/businessfawcett-cloud/Madeline) — a small,
real, personal Next.js App Router site (a gift/reveal site) with genuinely non-obvious logic:
a client-side-only "type the right name" gate, two near-duplicate unused component variants
toggled via commented-out imports, and a multi-page visit-gating rule. Zero existing tests,
zero TODO/FIXME comments anywhere in the codebase — chosen because it's messy in exactly the
way the brief asked for, not a clean toy example.

## The headline result

A fresh agent (no access to the original repo, only `CLAUDE.md`, `.claude/`, `spec/`, and two
locked test files) built a working Next.js app from scratch and converged to **3/3 tests
passing, reproducibly** (verified independently, not just trusted from the agent's own
report), in ~12–16 seconds per run. That held across **two model tiers** (Sonnet and Haiku),
isolated as a single-variable comparison — same spec, same tests, same hooks, same directory,
only the model changed.

That result did not come for free — getting to a *clean* reading required finding and fixing
three real bugs along the way, one of which was in the generated test harness itself, not in
either rebuild. The bugs, and what they revealed, are more interesting than the final number.

## Three failure categories, not two

The original design anticipated two failure modes for a rebuild agent, matching
AgentModernize's own taxonomy:

1. **Structural mismatch** — right logic, wrong shape (function signature, endpoint path).
2. **Implicit-rule miss** — right shape, subtly wrong behavior.

A real, fresh-agent handoff surfaced a **third category neither this design nor
AgentModernize's predicted**:

3. **Environment/tooling-friction masquerading as a requirement.** A generated test typed a
   secret value faster than React's hydration attached its event handler — a real, reproducible
   race, but an artifact of *how the test was written* (Playwright acting at machine speed
   immediately after page load), not a real user behavior. The agent, correctly doing exactly
   what it was told — make the test pass — reasonably concluded it needed to defeat React's
   event system with a raw `addEventListener` to satisfy it. That's not the agent gaming the
   test in the "hardcode to the fixture" sense the design already guards against; it's the test
   itself being an inaccurate model of reality, faithfully implemented. **A black-box test
   isn't automatically a correct behavioral spec just because it's black-box — it can encode an
   artifact of how it was measured rather than what should actually happen.** This is a design
   principle to carry forward, not a one-off bug: the fix was in the test (wait for the page to
   actually be interactive before typing), not in the rebuild.

   A second instance of the same category: the generated test hardcoded `127.0.0.1`, but Next's
   dev server only trusts `localhost` as a default dev origin — a pure harness bug, unrelated to
   either rebuild's own code, that silently blocked hydration and cost real debugging time
   before being traced to its actual cause.

Both were fixed at the source (`src/spec/generateGateTests.ts`) and the re-run confirmed clean:
4 consecutive runs, 3/3 passing every time, run time dropped from 41–61s to ~12–13s once the
harness stopped fighting itself.

## The methodology-level gap: contracts without tests don't get built

`spec/contracts/` locked 8 page contracts; only 2 had any test coverage (v0's test generator
is scoped to the client-side-gate case type). Under strict TDD discipline, a rebuild agent
**correctly refuses** to build ahead of a failing test — so 6 locked contracts went
unimplemented, not because anything was wrong, but because the methodology has no mechanism
to require building something no test demands.

This means **the case-file queue being fully resolved does not imply the rebuild will be
complete.** There's a real, structural gap between "spec exists" and "spec is enforced" — test
coverage, not contract coverage, is what actually gates what gets built. Sonnet's handoff
explicitly flagged this as a judgment call. It's a real, generalizable insight about this whole
approach, not an implementation bug — worth stating explicitly as a limitation in generated
CLAUDE.md files going forward (not yet done — backlogged).

## The Sonnet-vs-Haiku comparison

Single-variable isolation: same `Madeline-rebuild/` directory, same spec/tests/hooks, only the
implementation reset between runs, only the model (`sonnet` vs `haiku`) changed.

**Where the rails held identically across both tiers:** reading discipline (both read
`CLAUDE.md` → `.claude/rules/` → `.claude/settings.json` → `spec/` → contracts in full, before
writing code), and convergence speed on the two real, mechanically-tested behaviors (both
models converged in ~1 iteration each, once the harness bugs were fixed). This is real evidence
*for* the thesis: strict rails let a much weaker model succeed at what the rails actually check,
independent of reasoning strength.

**Where a real gap opened, and it's precise, not "Haiku is worse":** Haiku built placeholder
implementations for all 8 locked contract pages — including the 6 with zero test coverage —
directly contradicting the kickoff prompt's explicit "not batch regeneration, pick ONE
currently-failing test" instruction. It then self-reported "no ambiguities found," which wasn't
true — this was independently verified by inspecting the actual files it wrote, not trusted
from its own report. Sonnet, given the identical spec, correctly built only the two tested
pages and explicitly flagged the other six as a judgment call.

**The precise mechanism, not just the observation:** the PostToolUse test hook is real,
mechanical enforcement — which is exactly why both models nailed the *tested* behavior
identically. But "only build what's currently failing" was, until this finding, only a
sentence in the kickoff prompt. Nothing checked it. A model that weighs prose less heavily can
build every contract in `spec/` up front and still pass every test, because no test ever looks
at the untested files. **The hooks can't catch a violation of a rule they were never written to
check.** This directly confirms, with reproducible, model-strength-keyed evidence, something
the original project spec (§9a) already suspected in general terms: CLAUDE.md is advisory, not
enforced, at scale.

### The fix (built, not backlogged)

`generate_spec` now writes `spec/untested-contracts.json` (every route/contract file with no
covering test), and `.claude/settings.json` gets a second `PreToolUse` hook that blocks any
write to a file on that list — structurally identical to the existing `spec/`-edit-block hook,
not just a stronger sentence. Verified against the real case, not only synthetic fixtures:
simulating the hook against the exact files Haiku wrote confirms it blocks all 6 batch-built
pages while leaving the 2 genuinely tested files fully editable.

One bug was caught and fixed *while building this fix*, worth naming because it's the same
failure shape one layer up: the natural first implementation used each test's mutation-check
`sourceFile` as the "is this covered" signal — but a gate test's `sourceFile` is the *original*
app's guard file (needed only to pick a mutation target), not necessarily the route files it
behaviorally covers. Using it naively would have made the hook block `/` and `/home`
themselves — the exact files the tests require building — which would have made the hook
actively worse than no hook at all. Fixed with a separate `coveredRouteFiles` field and a
regression test locking in the distinction, verified against the real Madeline case before
being trusted.

## What's deliberately not done (named, not silently skipped)

- **Near-duplicate case fragmentation.** Three separate resolved cases exist for
  `login-gate.tsx` + two unused variants, with no cross-reference. A human resolving one as
  "intentional" and another as "bug" without realizing they're the same pattern is a real,
  silent-contradiction risk. Concretely manifested in this run (Sonnet had to infer the
  connection; nothing in the spec stated it).
- **Asset-manifest extraction** (binary files copied verbatim + hash manifest, locked contract
  tier) — explicitly deferred to a future pass mid-build.
- **A 4th mutator** ("no-op the handler entirely") — the current 3 (flip comparison, drop null
  check, off-by-one) can't produce a "handler never ran" mutant, so a test that can't
  distinguish "correctly rejected" from "never executed" isn't flagged as weak. Caught in
  practice: the "incorrect value" gate test passed on the very first try in both handoffs for
  exactly this reason.
- **The contract-coverage caveat is not yet written into generated `CLAUDE.md`** as an explicit,
  stated limitation of the methodology.
- **Weak-model diagnostic capability, genuinely untested.** Both real environment bugs were
  fixed *before* the Haiku run, by design, to isolate convergence speed. Whether a weaker model
  can diagnose an unscripted bug the way Sonnet diagnosed the hydration race (build a scratch
  instrumentation harness, form a hypothesis, verify it) remains a real, different, open
  question — not answered by anything in this document.

## Bottom line

The core loop (ingest → reconcile → spec → generate → test → verify) works, on a real messy
app, well enough to produce a locked spec that two different model tiers both built against
successfully — with the actual failure points being precise, reproducible, and in most cases
already fixed rather than papered over. The two most valuable findings weren't in the numbers:
a new failure category (test-harness artifacts becoming perceived requirements) and a precise,
reproducible mechanism for why "advisory" rules fail under a weaker model specifically. Both are
now either fixed or explicitly named for future work.
