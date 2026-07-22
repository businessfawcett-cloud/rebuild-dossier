# rebuild-dossier

An MCP server that reverse-engineers a trustworthy **rebuild spec** — a locked `CLAUDE.md`,
`.claude/` config, and a mutation-tested test suite — out of an existing app, so any coding
agent can rebuild it cleanly against that spec instead of guessing.

**It does not rebuild the app.** It produces the spec, contracts, and tests a coding agent
consumes to do that separately. This boundary is deliberate — see [Why](#why) below.

> **Status: v0.** The core loop works and has been validated end-to-end against one real,
> messy repo, including two independent fresh-agent handoffs on two model tiers. Read
> [docs/v0-findings.md](docs/v0-findings.md) for the honest result, including what broke.

## Why

Prior research ([AgentModernize, arXiv:2605.17535](https://arxiv.org/abs/2605.17535)) found
that a rebuild pipeline scores **0%** behavioral equivalence with no verified feedback loop,
and only **9–19%** with a coarse one. The bet behind this tool: locking interface contracts
*before* running tests, plus a strict one-test-at-a-time retry loop instead of batch
regeneration, does meaningfully better.

The riskiest part of any such pipeline is silently validating a bug as intentional — four
sources of evidence can quietly agree on the same mistake with nobody ever having said why.
So the single non-negotiable rule in this tool: **auto-resolving an ambiguity requires both
signal agreement *and* an affirmative signal that someone actually decided** (a stated
comment, a TODO admitting a bug, or a direct human answer). Silent agreement alone — code and
observed behavior simply matching, with no one ever having said why — always becomes a
question, never an auto-resolution, no matter how high the apparent confidence.

## How it works

Six MCP tools, run from inside a normal Claude Code (or any MCP-compatible) session:

| Tool | What it does |
|---|---|
| `ingest_repo(path)` | Static analysis only, no LLM call: routes, `package.json`, build config (via AST, never executed), existing tests, and structural-smell detectors (e.g. a client-side-only credential check with no server-side verification) that surface real ambiguity even when nobody ever commented on it. |
| `crawl_site(url)` | Headless Playwright crawl of reachable routes, with progress notifications so long crawls don't get killed as unresponsive. |
| `flag_known_bug(description)` | Free text, stored verbatim. Always overrides auto-resolve for anything it matches — the cheapest, most authoritative signal in the system. |
| `get_case_queue()` / `resolve_case(id, decision)` | The ambiguity queue. Surfaces open questions via MCP elicitation when the client supports it; `resolve_case` is always available as a scripted fallback. |
| `generate_spec()` | Only callable once the case queue is empty. Writes `CLAUDE.md`, `.claude/rules/`, `.claude/settings.json` (hooks that *mechanically* enforce the discipline — see below), `spec/contracts/*.md`, `tests/visible/` + `tests/held-out/`, and `kickoff-prompt.txt` to a clean sibling `<repo>-rebuild/` directory — never into the original repo. Runs a real mutation check before finalizing tests: deliberately breaks the original code and confirms each generated test actually catches it, downgrading any that don't. |

### Rails that are mechanically enforced, not just written down

A comparison run across two model tiers found that a weaker model will happily read
`CLAUDE.md`, understand "only build what's currently failing, don't batch-regenerate," and
then quietly violate it anyway — because nothing *checked* it. Two rules in this tool are now
enforced by real hooks, not prose, for exactly that reason:

- **`spec/` is locked.** A `PreToolUse` hook blocks any edit under `spec/`.
- **Contracts without tests don't get built ahead of schedule.** `generate_spec` writes
  `spec/untested-contracts.json` (every route/contract with no covering test), and a second
  `PreToolUse` hook blocks writes to anything on that list — the same enforcement shape as the
  `spec/`-edit block, closing a gap that used to be advisory only.

A `PostToolUse` hook runs the visible test suite after every edit.

## Quick start

```bash
git clone https://github.com/businessfawcett-cloud/rebuild-dossier.git
cd rebuild-dossier
npm install
npx playwright install chromium   # needed for crawl_site
```

Add it as an MCP server in Claude Code (or any MCP-compatible client), then in a session:

```
ingest_repo({ path: "/path/to/some-app" })
get_case_queue({ repoPath: "/path/to/some-app", interactive: true })
# ...resolve whatever the queue surfaces...
generate_spec({ repoPath: "/path/to/some-app" })
```

This writes a clean `some-app-rebuild/` sibling directory. `cd` into it, start a **fresh**
Claude Code session (nothing else should be in scope), and paste the contents of its
`kickoff-prompt.txt`.

## Connecting from other tools (oh-my-pi, opencode, etc.)

Two ways to run this, both entirely local — there is no hosted/shared instance, and none is
required:

**stdio (default)** — each tool spawns its own copy of the server as a local subprocess. This
is the standard way every MCP client (Claude Code, [oh-my-pi](https://github.com/can1357/oh-my-pi),
[opencode](https://opencode.ai)) adds a local MCP server — point it at `npx tsx src/index.ts`
(or a built `node dist/index.js`) from this repo's directory. No extra setup, no auth, nothing
in this section applies.

**HTTP (optional)** — one persistent server on `localhost` that multiple tools/sessions
connect to instead of each spawning their own. Useful if you want oh-my-pi and opencode (or
several Claude Code sessions) sharing one running instance. Still fully local — `MCP_ALLOWED_HOSTS`
only needs to include the hostname you'll actually connect to (`localhost`), not a real domain,
unless you deliberately choose to expose this beyond your own machine.

```bash
npm run build
PORT=8080 \
MCP_AUTH_TOKEN=$(openssl rand -hex 32) \
MCP_ALLOWED_HOSTS=localhost,127.0.0.1 \
REBUILD_DOSSIER_ALLOWED_PATHS=/absolute/path/to/your/projects \
npm run start:http:prod
```

All three env vars are required — the server refuses to start without them, on purpose:
`MCP_AUTH_TOKEN` gates every `/mcp` request (bearer auth), `MCP_ALLOWED_HOSTS` guards against
DNS-rebinding, and `REBUILD_DOSSIER_ALLOWED_PATHS` (comma-separated absolute directories) is
the only paths `ingest_repo`/`generate_spec`/etc. are allowed to touch — set it to whatever
parent directory holds the repos you actually want to rebuild.

**oh-my-pi** (`.omp/mcp.json` or `~/.omp/agent/mcp.json`):

```json
{
  "mcpServers": {
    "rebuild-dossier": {
      "type": "http",
      "url": "http://localhost:8080/mcp",
      "headers": { "Authorization": "Bearer ${REBUILD_DOSSIER_TOKEN}" }
    }
  }
}
```

**opencode** (`opencode.json`):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "rebuild-dossier": {
      "type": "remote",
      "url": "http://localhost:8080/mcp",
      "enabled": true,
      "oauth": false,
      "headers": { "Authorization": "Bearer {env:REBUILD_DOSSIER_TOKEN}" }
    }
  }
}
```

`oauth: false` disables opencode's automatic OAuth discovery on a `401` — this server only
supports the static bearer token above, not a real OAuth flow. Set the referenced env var
(`REBUILD_DOSSIER_TOKEN` in both examples) to the same value as `MCP_AUTH_TOKEN` above.

## Development

```bash
npm test        # full suite
npm run typecheck
```

Small, single-purpose functions; TDD throughout (tests are written before the implementation
they cover, including for the reconciliation logic itself — this is a tool that generates
tests, so its own correctness matters as much as any feature).

## Current scope, and what's deliberately not built yet

v0 is scoped to prove the core loop, not to be feature-complete. Deliberately deferred, and
tracked as real backlog rather than silently skipped:

- Video/screen-recording ingestion and the video-LLM flagged-window review.
- Original-CLAUDE.md / auto-memory as an evidence source.
- Live Chrome MCP capture for auth-gated/multi-account flows a headless crawler can't reach.
- Asset-manifest extraction (binary files copied byte-verbatim + a hash manifest, locked
  contract tier) — real design exists, not yet built.
- A near-duplicate-component detector (two components implementing the same decision with no
  cross-reference between their case-file entries — a real, observed gap, see the findings doc).
- A mutator that no-ops a handler entirely (the current three — flip comparison, drop null
  check, off-by-one — can't produce a "this branch never ran" mutant).

See [docs/v0-findings.md](docs/v0-findings.md) for the full, honest write-up: the real bugs
found and fixed during validation, the comparison across model tiers, and what's still open.

## License

[MIT](LICENSE)
