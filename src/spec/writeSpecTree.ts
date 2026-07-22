import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { EvidenceBundle } from '../ingest/evidenceSchema.js';
import type { Case } from '../reconciliation/types.js';
import { generateClaudeMd } from './generateClaudeMd.js';
import { generateTestingRule } from './generateRules.js';
import { generateSettingsJson } from './generateSettingsJson.js';
import { generateContracts } from './generateContracts.js';
import { generateTests } from './generateTests.js';
import { generateGateTests, generateSecretEntryTests } from './generateGateTests.js';
import { computeUntestedContractFiles } from './computeUntestedContractFiles.js';
import { generateTestDependencies, type TestPlacement } from './generateTestDependencies.js';
import { generateSpecAuditorAgent, generateTestVerifierAgent } from './generateAgents.js';
import { generateParallelTestFixWorkflow } from './generateWorkflow.js';
import { generateVerifyAgainstSpecSkill } from './generateSkill.js';
import { KICKOFF_PROMPT } from './generateKickoffPrompt.js';
import { runMutationCheck, type MutationCheckReport } from '../mutation/runMutationCheck.js';

export interface WriteSpecTreeInput {
  repoPath: string;
  outputDir: string;
  evidence: EvidenceBundle;
  cases: Case[];
}

export interface WriteSpecTreeResult {
  mutationReport: MutationCheckReport;
}

// The generated tests are always vitest, regardless of what test runner the
// original repo used (we don't reuse the original's runner — we generate our
// own). So the rebuild's own package.json.scripts.test is always a concrete,
// directly-runnable command; "npm test" (used in prose and the PostToolUse
// hook) is always safe to say separately because it delegates to that script
// rather than being stored as its value — storing "npm test" as scripts.test
// itself would make `npm test` recurse into itself.
const REBUILD_TEST_SCRIPT = 'vitest run';
const RUN_TESTS_COMMAND = 'npm test';

function buildStackLines(evidence: EvidenceBundle): string[] {
  const deps = { ...evidence.packageJson.dependencies, ...evidence.packageJson.devDependencies };
  const framework = Object.hasOwn(deps, 'next')
    ? 'Next.js'
    : Object.hasOwn(deps, 'express')
      ? 'Express'
      : Object.hasOwn(deps, 'react')
        ? 'React'
        : 'unknown';
  return [`lang: TypeScript / ${framework}`];
}

function sanitizeTopicKeyFilename(topicKey: string): string {
  return (
    topicKey
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
      .join('-') + '.md'
  );
}

function decisionMarkdown(kase: Case): string {
  const decision = kase.autoResolution?.decision ?? kase.humanDecision?.decision ?? 'unresolved';
  const reason = kase.autoResolution?.reason ?? kase.humanDecision?.note;
  const signalLines = kase.signals.map((s) => `- (${s.source}) ${s.claim}`).join('\n');
  return `# Decision: ${kase.topicKey}

- **Status:** ${kase.status}
- **Decision:** ${decision}
${reason ? `- **Reason:** ${reason}\n` : ''}
## Evidence

${signalLines || '(no signals recorded)'}
`;
}

// The one and only place this tool writes outside its own scratch state —
// always a clean sibling directory, never the original repo, and refuses to
// clobber an existing output so a prior rebuild attempt is never silently lost.
export function writeSpecTree(input: WriteSpecTreeInput): WriteSpecTreeResult {
  const { repoPath, outputDir, evidence, cases } = input;

  if (existsSync(outputDir)) {
    throw new Error(`Refusing to overwrite existing directory: ${outputDir}`);
  }

  mkdirSync(join(outputDir, '.claude', 'rules'), { recursive: true });
  mkdirSync(join(outputDir, '.claude', 'agents'), { recursive: true });
  mkdirSync(join(outputDir, '.claude', 'workflows'), { recursive: true });
  mkdirSync(join(outputDir, '.claude', 'skills'), { recursive: true });
  mkdirSync(join(outputDir, 'spec', 'contracts'), { recursive: true });
  mkdirSync(join(outputDir, 'tests', 'visible'), { recursive: true });
  mkdirSync(join(outputDir, 'tests', 'held-out'), { recursive: true });

  writeFileSync(
    join(outputDir, 'CLAUDE.md'),
    generateClaudeMd({
      projectName: evidence.packageJson.name ?? 'rebuild',
      stackLines: buildStackLines(evidence),
      testCommand: RUN_TESTS_COMMAND
    })
  );

  const testingRule = generateTestingRule(RUN_TESTS_COMMAND);
  writeFileSync(join(outputDir, '.claude', 'rules', testingRule.filename), testingRule.content);

  writeFileSync(join(outputDir, '.claude', 'settings.json'), JSON.stringify(generateSettingsJson(RUN_TESTS_COMMAND), null, 2));

  for (const file of [generateSpecAuditorAgent(), generateTestVerifierAgent()]) {
    writeFileSync(join(outputDir, '.claude', 'agents', file.filename), file.content);
  }

  const workflowFile = generateParallelTestFixWorkflow();
  writeFileSync(join(outputDir, '.claude', 'workflows', workflowFile.filename), workflowFile.content);

  const skillFile = generateVerifyAgainstSpecSkill();
  const skillPath = join(outputDir, '.claude', 'skills', skillFile.filename);
  mkdirSync(dirname(skillPath), { recursive: true });
  writeFileSync(skillPath, skillFile.content);

  for (const file of generateContracts(repoPath, evidence.routes)) {
    writeFileSync(join(outputDir, 'spec', 'contracts', file.filename), file.content);
  }

  for (const kase of cases.filter((c) => c.status !== 'open')) {
    writeFileSync(join(outputDir, 'spec', sanitizeTopicKeyFilename(kase.topicKey)), decisionMarkdown(kase));
  }

  writeFileSync(join(outputDir, 'kickoff-prompt.txt'), KICKOFF_PROMPT);

  const { visible: expressVisible, heldOut } = generateTests(repoPath, evidence, cases);
  const gateTests = [...generateGateTests(repoPath, evidence, cases), ...generateSecretEntryTests(repoPath, evidence, cases)];
  const visible = [...expressVisible, ...gateTests];

  // Makes "only build what's currently failing" mechanically enforced (via
  // the PreToolUse hook in settings.json) instead of just a sentence in the
  // kickoff prompt a model can weigh less heavily than intended.
  const testedSourceFiles = [...visible, ...heldOut].flatMap((f) => f.coveredRouteFiles ?? [f.sourceFile]);
  const untestedContractFiles = computeUntestedContractFiles(evidence.routes, testedSourceFiles);
  writeFileSync(join(outputDir, 'spec', 'untested-contracts.json'), JSON.stringify(untestedContractFiles, null, 2));

  writeFileSync(
    join(outputDir, 'package.json'),
    JSON.stringify(
      {
        name: `${evidence.packageJson.name ?? 'app'}-rebuild`,
        private: true,
        type: 'module',
        scripts: { test: REBUILD_TEST_SCRIPT },
        devDependencies: gateTests.length > 0 ? { vitest: '^4.0.0', playwright: '^1.61.1' } : { vitest: '^4.0.0' }
      },
      null,
      2
    )
  );

  if (gateTests.length > 0) {
    // Each gate test file spawns its own `next dev` against the SAME app
    // directory. Next.js only allows one dev server per project directory
    // at a time regardless of port, so running test files concurrently
    // (vitest's default) makes them fight over that lock. Sequential file
    // execution avoids it — and matches the tool's own one-test-at-a-time
    // philosophy rather than losing anything real.
    writeFileSync(
      join(outputDir, 'vitest.config.ts'),
      `import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    fileParallelism: false
  }
});
`
    );
  }

  const mutationReport = runMutationCheck(repoPath, [...visible, ...heldOut]);
  const weak = new Set(mutationReport.weakTestFiles);

  if (weak.size > 0) {
    mkdirSync(join(outputDir, 'tests', 'weak'), { recursive: true });
  }
  const placements: TestPlacement[] = [
    ...visible.map((file): TestPlacement => ({ file, dir: weak.has(file.filename) ? 'weak' : 'visible' })),
    ...heldOut.map((file): TestPlacement => ({ file, dir: weak.has(file.filename) ? 'weak' : 'held-out' }))
  ];
  for (const { file, dir } of placements) {
    writeFileSync(join(outputDir, 'tests', dir, file.filename), file.content);
  }

  writeFileSync(
    join(outputDir, 'spec', 'test-dependencies.json'),
    JSON.stringify(generateTestDependencies(placements), null, 2)
  );

  return { mutationReport };
}
