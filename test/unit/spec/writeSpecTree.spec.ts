import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeSpecTree } from '../../../src/spec/writeSpecTree.js';
import { KICKOFF_PROMPT } from '../../../src/spec/generateKickoffPrompt.js';
import type { EvidenceBundle } from '../../../src/ingest/evidenceSchema.js';
import type { Case } from '../../../src/reconciliation/types.js';

const now = new Date(0).toISOString();

describe('writeSpecTree', () => {
  it('writes the full spec/.claude/tests structure and runs the mutation check', () => {
    const repoDir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-writetree-repo-'));
    const outputDir = join(tmpdir(), `rebuild-dossier-writetree-out-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    try {
      writeFileSync(
        join(repoDir, 'server.ts'),
        [
          "import express from 'express';",
          'const app = express();',
          "app.get('/api/users/:id', (req, res) => {",
          '  const user = null;',
          '  if (!user) {',
          "    return res.status(404).json({ error: 'not found' });",
          '  }',
          '  return res.status(200).json(user);',
          '});',
          'export default app;'
        ].join('\n')
      );

      const evidence: EvidenceBundle = {
        repoPath: repoDir,
        generatedAt: now,
        packageJson: { name: 'sample-app', scripts: { test: 'npm test' }, dependencies: { express: '^4.19.0' }, devDependencies: {} },
        buildConfig: [],
        routes: [{ path: '/api/users/:id', method: 'GET', file: 'server.ts', kind: 'api', startLine: 3 }],
        existingTests: [],
        signals: []
      };
      const cases: Case[] = [
        {
          id: 'case:route:GET:/api/users/:id',
          topicKey: 'route:GET:/api/users/:id',
          signals: [
            {
              id: 's1',
              source: 'ingest',
              locator: { file: 'server.ts', startLine: 5, endLine: 5 },
              topicKey: 'route:GET:/api/users/:id',
              claim: 'returns 404 when the user does not exist',
              evidenceText: 'e',
              detectedAt: now
            }
          ],
          matchedKnownBugs: [],
          status: 'auto_resolved',
          autoResolution: { decision: 'intentional', reason: 'r' }
        }
      ];

      const report = writeSpecTree({ repoPath: repoDir, outputDir, evidence, cases });

      expect(existsSync(join(outputDir, 'CLAUDE.md'))).toBe(true);
      expect(readFileSync(join(outputDir, 'CLAUDE.md'), 'utf-8')).toContain('sample-app');

      expect(existsSync(join(outputDir, '.claude', 'rules', 'testing.md'))).toBe(true);
      expect(existsSync(join(outputDir, '.claude', 'settings.json'))).toBe(true);
      const settings = JSON.parse(readFileSync(join(outputDir, '.claude', 'settings.json'), 'utf-8'));
      expect(settings.hooks.PostToolUse[0].hooks[0].command).toBe('npm test');

      const contractFiles = readdirSync(join(outputDir, 'spec', 'contracts'));
      expect(contractFiles.length).toBeGreaterThan(0);

      const decisionFiles = readdirSync(join(outputDir, 'spec')).filter((f) => f.endsWith('.md'));
      expect(decisionFiles.length).toBeGreaterThan(0);

      expect(readFileSync(join(outputDir, 'kickoff-prompt.txt'), 'utf-8')).toBe(KICKOFF_PROMPT);

      expect(existsSync(join(outputDir, 'package.json'))).toBe(true);
      const pkg = JSON.parse(readFileSync(join(outputDir, 'package.json'), 'utf-8'));
      expect(pkg.devDependencies.vitest).toBeDefined();
      // Regression: scripts.test must be a concrete, directly-runnable command
      // (the generated tests are always vitest), never a copy of whatever
      // "npm test" string is used elsewhere — that would make `npm test`
      // recurse into itself.
      expect(pkg.scripts.test).toBe('vitest run');

      const visibleFiles = readdirSync(join(outputDir, 'tests', 'visible'));
      const heldOutFiles = readdirSync(join(outputDir, 'tests', 'held-out'));
      expect(visibleFiles.length + heldOutFiles.length).toBeGreaterThan(0);

      expect(report.mutationReport.results.length).toBeGreaterThan(0);

      // The one route in this fixture is fully covered by a generated test.
      expect(JSON.parse(readFileSync(join(outputDir, 'spec', 'untested-contracts.json'), 'utf-8'))).toEqual([]);
    } finally {
      rmSync(repoDir, { recursive: true, force: true });
      rmSync(outputDir, { recursive: true, force: true });
    }
  }, 60000);

  it('writes a vitest.config.ts disabling file parallelism when gate tests are generated (each spawns its own next dev against the same app dir)', () => {
    const repoDir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-writetree-repo-'));
    const outputDir = join(tmpdir(), `rebuild-dossier-writetree-out-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    try {
      writeFileSync(
        join(repoDir, 'app-shell.tsx'),
        ['useEffect(() => {', '  if (!getUnlocked()) {', '    router.replace("/");', '  }', '}, []);'].join('\n')
      );
      writeFileSync(join(repoDir, 'page.tsx'), 'export default function LoginPage() { return null; }');
      mkdirSync(join(repoDir, 'home'), { recursive: true });
      writeFileSync(join(repoDir, 'home', 'page.tsx'), 'export default function HomePage() { return null; }');
      mkdirSync(join(repoDir, 'letter'), { recursive: true });
      writeFileSync(join(repoDir, 'letter', 'page.tsx'), 'export default function LetterPage() { return null; }');

      const evidence: EvidenceBundle = {
        repoPath: repoDir,
        generatedAt: now,
        packageJson: { name: 'app', scripts: {}, dependencies: { next: '^16.0.0' }, devDependencies: {} },
        buildConfig: [],
        routes: [
          { path: '/', file: 'page.tsx', kind: 'page', startLine: 1 },
          { path: '/home', file: 'home/page.tsx', kind: 'page', startLine: 1 },
          { path: '/letter', file: 'letter/page.tsx', kind: 'page', startLine: 1 }
        ],
        existingTests: [],
        signals: []
      };
      const cases: Case[] = [
        {
          id: 'case:smell:client-side-secret-gate:login-gate.tsx',
          topicKey: 'smell:client-side-secret-gate:login-gate.tsx',
          signals: [],
          matchedKnownBugs: [],
          status: 'resolved_by_human',
          humanDecision: { decision: 'intentional', decidedAt: now, via: 'resolve_case_tool' }
        }
      ];

      writeSpecTree({ repoPath: repoDir, outputDir, evidence, cases });

      expect(existsSync(join(outputDir, 'vitest.config.ts'))).toBe(true);
      expect(readFileSync(join(outputDir, 'vitest.config.ts'), 'utf-8')).toContain('fileParallelism: false');

      // Regression: the gate-redirect test's `sourceFile` is the ORIGINAL
      // app's guard file (app-shell.tsx here) — used only to pick a mutation
      // target — not the route files it actually behaviorally covers ('/' and
      // '/home'). Using sourceFile alone here would wrongly mark both of
      // those routes "untested" and have the PreToolUse hook block the exact
      // files this test requires a rebuild agent to build.
      const untested = JSON.parse(readFileSync(join(outputDir, 'spec', 'untested-contracts.json'), 'utf-8'));
      expect(untested).toEqual(['letter/page.tsx']);
    } finally {
      rmSync(repoDir, { recursive: true, force: true });
      rmSync(outputDir, { recursive: true, force: true });
    }
  }, 60000);

  it('refuses to overwrite an existing output directory', () => {
    const repoDir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-writetree-repo-'));
    const outputDir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-writetree-out-'));
    try {
      const evidence: EvidenceBundle = {
        repoPath: repoDir,
        generatedAt: now,
        packageJson: { scripts: {}, dependencies: {}, devDependencies: {} },
        buildConfig: [],
        routes: [],
        existingTests: [],
        signals: []
      };
      expect(() => writeSpecTree({ repoPath: repoDir, outputDir, evidence, cases: [] })).toThrow();
    } finally {
      rmSync(repoDir, { recursive: true, force: true });
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
