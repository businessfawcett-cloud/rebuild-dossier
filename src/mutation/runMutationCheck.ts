import { cpSync, existsSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsMorphEngine } from './tsMorphEngine.js';
import type { MutationSite } from './engine.js';

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.dossier', 'coverage']);
const OWN_PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const VITEST_ENTRY = join(OWN_PROJECT_ROOT, 'node_modules/vitest/vitest.mjs');

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

export function runMutationCheck(originalRepoPath: string, targets: MutationTarget[]): MutationCheckReport {
  const results: MutationResult[] = [];

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
    const sites = sitesBySourceFile.get(target.sourceFile) ?? [];

    for (const site of sites) {
      const scratchDir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-mutation-'));
      try {
        cpSync(originalRepoPath, scratchDir, {
          recursive: true,
          filter: (src) => !IGNORED_DIRS.has(src.split(/[\\/]/).pop() ?? '')
        });
        linkNodeModules(originalRepoPath, scratchDir);

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

  return { results, weakTestFiles };
}
