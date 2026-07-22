# rebuild-dossier v0: findings

**Status:** v0 built (6 MCP tools, 238 unit tests), validated end-to-end against one real repo
(Madeline) with two independent fresh-agent handoffs on two model tiers, plus a second,
differently-shaped real repo (catchandtrade) validated at the generator/mutation-check level —
**not yet via a fresh-agent handoff; see "Generalization run" below for exactly what that does
and doesn't establish.** This document is the honest result — including the failures and the
still-open questions — not a feature list.

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

## Generalization run: catchandtrade — what it shows and what it doesn't

Every result above is one app shape: Next.js, client-side gate pattern, zero API routes. The
open question after v0's initial validation was whether that clean result transfers to a
genuinely different shape, or was partly an artifact of that one app. This run does **not**
answer that question yet — it answers a narrower one, and the gap between the two matters.

**The target:** [businessfawcett-cloud/catchandtrade](https://github.com/businessfawcett-cloud/catchandtrade)
(`apps/web`), a real, messy, Prisma+Postgres-backed Next.js App Router app — a trading-card
marketplace with real Stripe/eBay/auth integration, 83 routes (64 API + 19 page). Chosen
deliberately for being a stress test, not a curated example: its own `CLAUDE.md` claims Express
is an active technology; the actual current code has zero Express anywhere, a live example of
why stale docs can't be trusted naively as an evidence source (still on the backlog).

**What this run actually found and fixed (generator-level, verified by direct execution):**
`ingest_repo`'s route detector held up cleanly on 83 real routes, including dynamic segments.
But the only API-contract test generator that existed was hard-gated on the `express`
dependency — this app has none (its API routes are Next.js Route Handlers, `route.ts` exporting
`GET`/`POST`/etc., no shared app instance) — so it silently produced zero tests for all 64 API
routes, while still writing correct contracts for every one of them. That's worse than a weak
test: `spec/untested-contracts.json` would have listed 55 unique files (effectively the app's
entire surface) as untested, and the enforcement hook would have blocked a rebuild agent from
building any of it. Built `src/spec/generateNextApiTests.ts` to close this — a generator that
imports each route handler directly and calls it with a constructed `NextRequest`, no server
boot needed. Running this against the real app (not a fixture) also surfaced two further real
bugs in the mutation-check harness itself, both fixed: no baseline-pass check (a test that never
passes looked identical to a 100%-effective one) and a broken alias-resolution fix that worked
on a tiny fixture but failed on the real app's own `node_modules`.

**The real, verified result of the generator fix:** `mutationsChecked` went from 0 to 353 across
the 64 API routes. 32 landed as genuinely mutation-verified tests (20 visible, 12 held-out) —
real assertions that caught real injected bugs in a real, messy, integration-heavy app. The
other 32 were honestly downgraded: 14 weak (ran fine, killed nothing), 18 unrunnable (never
passed even unmutated — no live Postgres, missing Stripe/eBay/JWT env vars, infrastructure a
bare clone genuinely can't exercise). `untested-contracts.json` dropped from 55 files to 19, all
of them page routes outside this generator's scope — every API route now gets a real attempt,
though only half of those attempts are currently trustworthy.

**What this run did *not* test — the actual generalization question, still open:**
- **No fresh-agent handoff was run.** Nobody handed the catchandtrade-generated spec to a fresh
  Sonnet or Haiku session to see whether it converges the way Madeline's did. Whether the
  end-to-end loop — fast convergence, clean red-green discipline, the mechanically-enforced
  rails actually holding under a real agent — transfers to this app shape is unknown. What's
  validated is narrower: the generator now produces real, mutation-verified tests for this app
  shape. That the tests are good is necessary for a handoff to work; it isn't sufficient
  evidence that one would.
- **Reconciliation on API-shaped ambiguity is untested, not passed.** Zero signals were
  generated for this app — confirmed by `grep`, not a detector bug: the codebase genuinely has
  no `TODO`/`FIXME` comments and no client-side-gate pattern to trip the smell detector. There
  was no ambiguity for reconciliation to resolve, so the question "does reconciliation behave
  the same on an API validation rule or error-response shape as it did on a UI gate" has no
  answer from this run either way.

Both of these remain the actual generalization finding this build still owes.

## Weak-model diagnostic experiment: what Haiku actually did with a real, unscripted bug

The original Sonnet-vs-Haiku comparison (above) deliberately fixed both real environment bugs
*before* the Haiku run, to isolate convergence speed as a single variable. That left a real,
separate question genuinely open: can a weaker model diagnose an unscripted harness bug the way
Sonnet diagnosed the hydration race — or does it get stuck, or produce a workaround instead of a
diagnosis? This experiment answers it.

**Setup:** a fresh copy of Madeline was run through the current, fully-fixed pipeline, then one
deliberate reversion was applied to the generated gate tests — `baseUrl` changed back from
`` `http://localhost:${port}` `` to `` `http://127.0.0.1:${port}` `` (the real, original bug:
Next's dev server doesn't trust `127.0.0.1` as a dev origin, so hydration never completes),
**including removing the explanatory comment** that named the fix, so the agent got zero hints.
Pass/fail criteria were written down before running: success means the agent's investigation
correctly attributes the failure to the origin-trust mechanism and doesn't edit real app logic
chasing a phantom bug; failure means it edits real logic or gets stuck; partial means it works
around the symptom without understanding it.

**First run: confounded, not a real result.** Haiku reported 3/3 passing; independently verified
and genuinely true, but for the wrong reason — its own `package.json` pinned `"next": "^14.0.0"`,
which resolved to 14.2.35, a version that (confirmed directly) simply doesn't have the
`127.0.0.1` origin-trust restriction that the real app's 16.2.10 does. The bug never manifested;
there was nothing to diagnose. This is itself a real finding: nothing in `generate_spec`'s
contracts pinned an exact dependency version, so a rebuild agent could silently drift past the
exact bug an experiment (or a real rebuild) was trying to surface. Fixed
(`src/spec/pinDependencyVersions.ts`): the exact installed version from the original app's own
`node_modules` is now written into the generated `package.json`, locked the same way interface
contracts are.

**Second, controlled run — the real result:** with `next@16.2.10`/`react@19.2.7`/`react-dom@19.2.7`
pinned exactly and the agent told these versions are locked, a fresh Haiku session hit the real
bug. Verified independently: **1/3 visible tests passing**, the other 2 failing with the exact
original `127.0.0.1` timeout signature. Checked the actual code Haiku wrote, not just its
report: it edited real application navigation logic three separate times chasing the failure —
`window.location.href` → `.assign()` → `router.push()` — plus added a `setTimeout(..., 0)`
"small delay" to a redirect `useEffect`, explicitly framed as fixing a timing/race issue. None of
that could have worked; the real cause is a total hydration failure, not a race, so no amount of
client-side timing adjustment addresses it. It ultimately stopped and reported honestly rather
than fabricating success: *"client-side navigation is not working... this suggests the issue is
environmental rather than code-based... the Next.js dev server may be missing configuration."*

**Classification, against the criteria written down before the run:** by strict letter, this is
**failure** — real application code was edited multiple times attempting to fix what was
actually a harness-level bug, exactly the failure mode the criteria named. But it's a
meaningfully different failure than "stuck with nothing useful": Haiku landed on a substantively
correct *category* of explanation (environmental/dev-server, not app logic) without ever
pinpointing the specific mechanism, and reported accurate pass/fail counts and explicit
uncertainty rather than papering over the result.

**Contrast with Sonnet's earlier hydration-race diagnosis (a different harness bug, same app):**
Sonnet found a working, if non-idiomatic, fix — a raw `addEventListener` bypassing React's event
system — and "won," even though winning revealed the deeper test-harness-artifact problem.
Haiku sensed the right category here but never converged and never found any working
workaround. The real, useful signal for this build's core thesis: **a weaker model can sense
"this isn't my code's fault" without being able to act on that insight.** It gets partway
(correct categorization) and stops there — neither diagnosing precisely nor working around it,
which is a third, distinct outcome from either "diagnoses" or "produces a workaround."

## HTTP transport: adversarially tested, not just built

The optional HTTP transport (for connecting from oh-my-pi/opencode, local-only, no cloud
deployment) got the same standard applied to it as generated tests get via mutation checking:
tried to actually break it against a live running server, rather than trusting that auth and
path/URL allowlisting worked because the code looked right. Found and fixed 3 real bypasses,
not equally serious:

1. **Structural, not narrow.** `isPathAllowed` did textual containment only
   (`path.resolve`/`path.relative`), never resolving the filesystem's actual reality. A
   junction planted inside an allowed repo directory let `ingest_repo` read *and write* files
   completely outside the sandboxed root — confirmed live, over real HTTP, with real auth. The
   check was applied at the wrong layer entirely (string comparison instead of real-path
   resolution), not a missed case within an otherwise-sound mechanism. Fixed by resolving the
   deepest-existing-ancestor's real path before the containment check.
2. **Narrow, encoding-shaped.** `isPrivateOrLoopbackAddress`'s IPv6 branch never checked
   IPv4-mapped addresses (`::ffff:127.0.0.1`), which sailed straight through the SSRF guard. The
   private-range logic itself was sound; one address representation was simply missing.
3. **Narrow, enumeration-shaped.** `100.64.0.0/10` (CGNAT, real cloud-provider metadata ranges)
   wasn't in the blocked list at all.

Auth itself (no token / wrong token / correct token, across every tool call) checked out clean
against a live server — no gap found there. The one structural finding (#1) is the one worth
weighing most heavily: a textual check that never touches the real filesystem is a category of
bug that can recur anywhere else path input is trusted, not a one-off miss.

## What's deliberately not done (named, not silently skipped)

- **A full fresh-agent handoff on catchandtrade.** The generator now produces real,
  mutation-verified tests for this app shape (see above), but nobody has handed the resulting
  spec to a fresh agent session to see whether it converges. This is the actual generalization
  finding this build still owes — good generated tests are necessary for a handoff to succeed,
  not sufficient evidence that one would.
- **Reconciliation on API-shaped ambiguity, untested.** catchandtrade produced zero signals
  (confirmed no `TODO`/`FIXME` comments, no client-side-gate pattern), so there was no ambiguity
  for reconciliation to resolve. Whether it behaves the same on an API validation rule or
  error-response shape as it did on a UI gate has no answer yet either way.
- **Asset-manifest extraction** (binary files copied verbatim + hash manifest, locked contract
  tier) — explicitly deferred to a future pass mid-build.
- **A 4th mutator** ("no-op the handler entirely") — the current 3 (flip comparison, drop null
  check, off-by-one) can't produce a "handler never ran" mutant, so a test that can't
  distinguish "correctly rejected" from "never executed" isn't flagged as weak. Caught in
  practice: the "incorrect value" gate test passed on the very first try in both handoffs for
  exactly this reason.
- **The contract-coverage caveat is not yet written into generated `CLAUDE.md`** as an explicit,
  stated limitation of the methodology.
- **The mutation-check's own ephemeral scratch copies** live nested under the OS temp
  directory; Next 16's Turbopack workspace-root auto-detection walks every ancestor directory
  looking for lockfiles, and a stray one anywhere above temp can make it pick the wrong root and
  fail confusingly. Doesn't affect a real rebuild directory (a normal, stable location), only
  the mutation-check's own QC step for gate tests — real, but scoped and environment-dependent;
  not chased this round.

Resolved since the initial write-up, worth noting precisely rather than silently deleting the
history: near-duplicate case fragmentation (three gate variants with no cross-reference between
their cases) is fixed — `relatedCaseIds` now cross-references cases whose source file is a
content near-duplicate of another's, surfaced directly in `get_case_queue`'s elicitation
message. Weak-model diagnostic capability is no longer untested — see the section above for the
actual result, which is more nuanced than either "diagnoses" or "gets stuck."

## Bottom line

The core loop (ingest → reconcile → spec → generate → test → verify) works, on a real messy
app, well enough to produce a locked spec that two different model tiers both built against
successfully — with the actual failure points being precise, reproducible, and in most cases
already fixed rather than papered over. Past that first validation, the picture is more mixed
than a clean "it generalizes" would suggest: the generator itself now handles a second, harder
app shape with real teeth, but the actual end-to-end question for that app shape is still open,
and a weaker model's diagnostic behavior on a real unscripted bug turned out to be a third,
distinct outcome — correct categorization without convergence — that neither of the two
originally-anticipated outcomes (diagnose, or produce a workaround) predicted. The two most
valuable findings from the original run weren't in the numbers:
a new failure category (test-harness artifacts becoming perceived requirements) and a precise,
reproducible mechanism for why "advisory" rules fail under a weaker model specifically. Both are
now either fixed or explicitly named for future work.
