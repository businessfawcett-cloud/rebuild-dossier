import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateSecretEntryTests, isComponentLive } from '../../../src/spec/generateGateTests.js';
import type { EvidenceBundle } from '../../../src/ingest/evidenceSchema.js';
import type { Case } from '../../../src/reconciliation/types.js';

const now = new Date(0).toISOString();

function minimalEvidence(overrides: Partial<EvidenceBundle> = {}): EvidenceBundle {
  return {
    repoPath: 'irrelevant',
    generatedAt: now,
    packageJson: { name: 'app', scripts: {}, dependencies: { next: '^16.0.0' }, devDependencies: {} },
    buildConfig: [],
    routes: [{ path: '/', file: 'src/app/page.tsx', kind: 'page', startLine: 1 }],
    existingTests: [],
    signals: [],
    ...overrides
  };
}

function gateCase(topicKey: string): Case {
  return {
    id: `case:${topicKey}`,
    topicKey,
    signals: [],
    matchedKnownBugs: [],
    status: 'resolved_by_human',
    humanDecision: { decision: 'intentional', decidedAt: now, via: 'resolve_case_tool' }
  };
}

function writeFile(dir: string, relPath: string, content: string) {
  const full = join(dir, relPath);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, content);
  return full;
}

describe('isComponentLive', () => {
  it('is true when another file imports it via an uncommented import', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-live-'));
    try {
      writeFile(dir, 'src/components/login-gate-variant-a.tsx', 'export function LoginGateA() { return null; }');
      const pageFile = writeFile(
        dir,
        'src/app/page.tsx',
        'import { LoginGateA } from "@/components/login-gate-variant-a";\nexport default function Page() { return <LoginGateA />; }'
      );
      expect(isComponentLive(dir, [pageFile], 'src/components/login-gate-variant-a.tsx')).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('is false when the only reference is commented out', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-live-'));
    try {
      writeFile(dir, 'src/components/login-gate.tsx', 'export function LoginGate() { return null; }');
      const pageFile = writeFile(
        dir,
        'src/app/page.tsx',
        [
          '// import { LoginGate } from "@/components/login-gate";',
          'import { LoginGateA as LoginGate } from "@/components/login-gate-variant-a";',
          'export default function Page() { return <LoginGate />; }'
        ].join('\n')
      );
      expect(isComponentLive(dir, [pageFile], 'src/components/login-gate.tsx')).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('generateSecretEntryTests', () => {
  it('generates correct/incorrect secret-entry tests for the live gate file only', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-secretentry-'));
    try {
      writeFile(
        dir,
        'src/components/login-gate.tsx',
        ['"use client";', 'const SECRET_NAME = "Madeline";', 'export function LoginGate() { return null; }'].join('\n')
      );
      writeFile(
        dir,
        'src/components/login-gate-variant-a.tsx',
        ['"use client";', 'const SECRET_NAME = "Madeline";', 'export function LoginGateA() { return null; }'].join('\n')
      );
      writeFile(
        dir,
        'src/app/page.tsx',
        [
          '// import { LoginGate } from "@/components/login-gate";',
          'import { LoginGateA as LoginGate } from "@/components/login-gate-variant-a";',
          'export default function Page() { return <LoginGate />; }'
        ].join('\n')
      );

      const evidence = minimalEvidence();
      const cases = [
        gateCase('smell:client-side-secret-gate:src/components/login-gate.tsx'),
        gateCase('smell:client-side-secret-gate:src/components/login-gate-variant-a.tsx')
      ];

      const files = generateSecretEntryTests(dir, evidence, cases);

      expect(files).toHaveLength(1);
      expect(files[0]?.sourceFile).toBe('src/components/login-gate-variant-a.tsx');
      expect(files[0]?.content).toContain('Madeline');
      expect(files[0]?.content).toContain('/home');
      expect(files[0]?.content).toContain('from-reconciliation');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns nothing when none of the resolved gate files are actually live', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-secretentry-'));
    try {
      writeFile(
        dir,
        'src/components/login-gate.tsx',
        ['"use client";', 'const SECRET_NAME = "Madeline";', 'export function LoginGate() { return null; }'].join('\n')
      );
      writeFile(dir, 'src/app/page.tsx', 'export default function Page() { return null; }');

      const evidence = minimalEvidence();
      const cases = [gateCase('smell:client-side-secret-gate:src/components/login-gate.tsx')];

      expect(generateSecretEntryTests(dir, evidence, cases)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
