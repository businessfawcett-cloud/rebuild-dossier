import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsMorphEngine } from './tsMorphEngine.js';
import type { MutationSite } from './engine.js';

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.dossier', 'coverage']);
const OWN_PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const VITEST_ENTRY = join(OWN_PROJECT_ROOT, 'node_modules/vitest/vitest.mjs');
const OWN_CONFIG_FILENAMES = ['vitest.config.ts', 'vitest.config.js', 'vitest.config.mts', 'vite.config.ts', 'vite.config.js', 'vite.config.mts'];

// The scratch copy only ever gets source files (copying node_modules per
// mutation would be far too expensive) — so a generated test importing the
// original repo's real runtime deps (express, etc.) needs node_modules
// linked in, not copied. Falls back to rebuild-dossier's own node_modules
// for fixtures that were never `npm install`ed (never true for a real
// target repo, only for test fixtures of this tool itself).
function linkNodeModules(originalRepoPath: string, scratchDir: string): void {
  const ownNodeModules = existsSync(join(originalRepoPath, 'node_modules'))
    ? join(originalRepoPath, 'node_modules')
    : join(OWN_PROJECT_ROOT, 'node_modules');
  try {
    symlinkSync(ownNodeModules, join(scratchDir, 'node_modules'), 'junction');
  } catch {
    // best effort — if this fails, dependency-resolution failures inside the
    // scratch copy will surface as a failed run, which reports as "killed"
    // rather than silently mis-scoring a real mutation
  }
}

function escapeForRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// tsconfig `@/*`-style path aliases are a common convention well beyond
// Next.js (Vite, webpack, any bundler-resolution setup), and vitest does not
// resolve them on its own — a target file reached only through such an alias
// would otherwise fail to even load inside the scratch copy, at which point
// every mutation looks identical to a real kill (see the baseline-pass check
// below for why that's dangerous). Only handles the overwhelmingly common
// single-wildcard shape ("@/*": ["./src/*"]) — a deliberately narrow, real
// fix, not a general tsconfig-paths resolver.
function writeAliasConfigIfNeeded(originalRepoPath: string, scratchDir: string): void {
  if (OWN_CONFIG_FILENAMES.some((f) => existsSync(join(scratchDir, f)))) return;

  const tsconfigPath = join(originalRepoPath, 'tsconfig.json');
  if (!existsSync(tsconfigPath)) return;

  let tsconfig: { compilerOptions?: { paths?: Record<string, string[]> } };
  try {
    tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));
  } catch {
    return;
  }

  const paths = tsconfig.compilerOptions?.paths;
  if (!paths || typeof paths !== 'object') return;

  const aliasEntries: string[] = [];
  for (const [key, targets] of Object.entries(paths)) {
    if (!Array.isArray(targets) || targets.length === 0) continue;
    const keyMatch = key.match(/^(.*)\/\*$/);
    const targetMatch = String(targets[0]).match(/^(.*)\/\*$/);
    if (!keyMatch || !targetMatch) continue;
    const findPattern = `^${escapeForRegex(keyMatch[1]!)}\\/`;
    const replacement = join(scratchDir, targetMatch[1]!).replace(/\\/g, '/') + '/';
    aliasEntries.push(`{ find: new RegExp(${JSON.stringify(findPattern)}), replacement: ${JSON.stringify(replacement)} }`);
  }
  if (aliasEntries.length === 0) return;

  // Deliberately a plain object export, not `defineConfig` from 'vitest/config'
  // — a real target repo's own node_modules (linked into the scratch copy)
  // essentially never has vitest as one of ITS dependencies (that's an
  // artifact of the tests THIS tool generates, not the target app's own
  // tooling), so that import would fail to resolve there. `defineConfig` is
  // purely a TS-typing helper with no runtime behavior beyond identity.
  writeFileSync(
    join(scratchDir, 'vitest.config.ts'),
    `export default {\n  resolve: { alias: [${aliasEntries.join(', ')}] }\n};\n`
  );
}

function prepareScratchCopy(originalRepoPath: string): string {
  const scratchDir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-mutation-'));
  cpSync(originalRepoPath, scratchDir, {
    recursive: true,
    filter: (src) => !IGNORED_DIRS.has(src.split(/[\\/]/).pop() ?? '')
  });
  linkNodeModules(originalRepoPath, scratchDir);
  writeAliasConfigIfNeeded(originalRepoPath, scratchDir);
  return scratchDir;
}

export interface MutationTarget {
  filename: string;
  content: string;
  sourceFile: string; // route's underlying source file, relative to the original repo
}

export interface MutationResult {
  testFile: string;
  mutator: string;
  locator: MutationSite['locator'];
  killed: boolean;
}

export interface MutationCheckReport {
  results: MutationResult[];
  weakTestFiles: string[]; // had at least one applicable mutant, but killed none of them
  unrunnableTestFiles: string[]; // never passed even against the original, unmutated code
}

// Generous enough for a Next.js dev-server boot (generateGateTests' own
// beforeAll budgets 90s for that), not just an in-process Express server.
const VITEST_RUN_TIMEOUT_MS = 120_000;

function runVitestOnce(scratchDir: string, testFilePath: string): boolean {
  try {
    const output = execFileSync('node', [VITEST_ENTRY, 'run', testFilePath, '--root', scratchDir, '--reporter=json', '--no-color'], {
      encoding: 'utf-8',
      timeout: VITEST_RUN_TIMEOUT_MS,
      stdio: ['ignore', 'pipe', 'ignore']
    });
    const jsonStart = output.indexOf('{');
    const parsed = JSON.parse(output.slice(jsonStart));
    return parsed.success === true;
  } catch {
    // A thrown execFileSync (non-zero exit, timeout, or crash) means the run
    // did not succeed — treat identically to a parsed failure.
    return false;
  }
}

// Runs the test once against a pristine (unmutated) copy. Without this, a
// test that can never pass — a broken import, a missing env var, whatever —
// looks IDENTICAL to a real kill on every single mutant: runVitestOnce
// returns false regardless of mutation, so killed = !succeeded ends up true
// across the board. That reports a 100% "kill rate" for a test providing
// zero real signal, which is worse than a weak test (0% kill rate) because a
// weak test at least gets flagged and moved to tests/weak/ instead of
// silently looking trustworthy.
function passesBaseline(originalRepoPath: string, target: MutationTarget): boolean {
  const scratchDir = prepareScratchCopy(originalRepoPath);
  try {
    const testDir = join(scratchDir, 'tests', 'visible');
    mkdirSync(testDir, { recursive: true });
    const testFilePath = join(testDir, target.filename);
    writeFileSync(testFilePath, target.content);
    return runVitestOnce(scratchDir, testFilePath);
  } finally {
    rmSync(scratchDir, { recursive: true, force: true });
  }
}

export function runMutationCheck(originalRepoPath: string, targets: MutationTarget[]): MutationCheckReport {
  const results: MutationResult[] = [];
  const unrunnableTestFiles: string[] = [];

  const sitesBySourceFile = new Map<string, MutationSite[]>();
  for (const target of targets) {
    if (!sitesBySourceFile.has(target.sourceFile)) {
      sitesBySourceFile.set(
        target.sourceFile,
        tsMorphEngine.enumerateSites(join(originalRepoPath, target.sourceFile), target.sourceFile)
      );
    }
  }

  for (const target of targets) {
    if (!passesBaseline(originalRepoPath, target)) {
      unrunnableTestFiles.push(target.filename);
      continue;
    }

    const sites = sitesBySourceFile.get(target.sourceFile) ?? [];

    for (const site of sites) {
      const scratchDir = prepareScratchCopy(originalRepoPath);
      try {
        const applied = tsMorphEngine.apply(join(scratchDir, site.locator.file), site);
        if (!applied) continue;

        const testDir = join(scratchDir, 'tests', 'visible');
        mkdirSync(testDir, { recursive: true });
        const testFilePath = join(testDir, target.filename);
        writeFileSync(testFilePath, target.content);

        const succeeded = runVitestOnce(scratchDir, testFilePath);
        results.push({
          testFile: target.filename,
          mutator: site.mutatorName,
          locator: site.locator,
          killed: !succeeded
        });
      } finally {
        rmSync(scratchDir, { recursive: true, force: true });
      }
    }
  }

  const weakTestFiles = targets
    .map((t) => t.filename)
    .filter((filename) => {
      const forThisFile = results.filter((r) => r.testFile === filename);
      return forThisFile.length > 0 && forThisFile.every((r) => !r.killed);
    });

  return { results, weakTestFiles, unrunnableTestFiles };
}
