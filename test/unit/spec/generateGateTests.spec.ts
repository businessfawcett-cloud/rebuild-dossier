import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateGateTests, findRedirectGateFile } from '../../../src/spec/generateGateTests.js';
import type { EvidenceBundle } from '../../../src/ingest/evidenceSchema.js';
import type { Case } from '../../../src/reconciliation/types.js';

const now = new Date(0).toISOString();

function minimalEvidence(overrides: Partial<EvidenceBundle> = {}): EvidenceBundle {
  return {
    repoPath: 'irrelevant',
    generatedAt: now,
    packageJson: { name: 'app', scripts: {}, dependencies: { next: '^16.0.0' }, devDependencies: {} },
    buildConfig: [],
    routes: [],
    existingTests: [],
    signals: [],
    ...overrides
  };
}

function gateCase(topicKey: string, status: Case['status'] = 'resolved_by_human'): Case {
  return {
    id: `case:${topicKey}`,
    topicKey,
    signals: [],
    matchedKnownBugs: [],
    status,
    humanDecision:
      status === 'resolved_by_human' ? { decision: 'intentional', decidedAt: now, via: 'resolve_case_tool' } : undefined
  };
}

describe('findRedirectGateFile', () => {
  it('finds a file that redirects when an unlock/auth check fails', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-gate-'));
    try {
      const file = join(dir, 'app-shell.tsx');
      writeFileSync(
        file,
        ['useEffect(() => {', '  if (!getUnlocked()) {', '    router.replace("/");', '  }', '}, []);'].join('\n')
      );
      expect(findRedirectGateFile(dir, [file])).toBe('app-shell.tsx');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns null when no file matches the redirect-guard pattern', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-gate-'));
    try {
      const file = join(dir, 'plain.tsx');
      writeFileSync(file, 'export function Plain() { return null; }');
      expect(findRedirectGateFile(dir, [file])).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('generateGateTests', () => {
  it('generates a redirect test when next is used, a gate case is resolved, and a protected route + guard file exist', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-gate-'));
    try {
      const guardFile = join(dir, 'app-shell.tsx');
      writeFileSync(
        guardFile,
        ['useEffect(() => {', '  if (!getUnlocked()) {', '    router.replace("/");', '  }', '}, []);'].join('\n')
      );

      const evidence = minimalEvidence({
        routes: [
          { path: '/', file: 'page.tsx', kind: 'page', startLine: 1 },
          { path: '/home', file: 'home/page.tsx', kind: 'page', startLine: 1 }
        ]
      });
      const cases = [gateCase('smell:client-side-secret-gate:login-gate.tsx')];

      const files = generateGateTests(dir, evidence, cases);

      expect(files).toHaveLength(1);
      expect(files[0]?.sourceFile).toBe('app-shell.tsx');
      expect(files[0]?.content).toContain('/home');
      expect(files[0]?.content).toContain('from-reconciliation');
      expect(files[0]?.content).toContain('next');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns nothing when next is not a dependency', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-gate-'));
    try {
      const evidence = minimalEvidence({
        packageJson: { scripts: {}, dependencies: {}, devDependencies: {} },
        routes: [{ path: '/home', file: 'home/page.tsx', kind: 'page', startLine: 1 }]
      });
      expect(generateGateTests(dir, evidence, [gateCase('smell:client-side-secret-gate:x.tsx')])).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns nothing when no gate case has been resolved', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-gate-'));
    try {
      const evidence = minimalEvidence({ routes: [{ path: '/home', file: 'home/page.tsx', kind: 'page', startLine: 1 }] });
      expect(generateGateTests(dir, evidence, [])).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns nothing when the gate case is still open (not yet resolved)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-gate-'));
    try {
      const evidence = minimalEvidence({ routes: [{ path: '/home', file: 'home/page.tsx', kind: 'page', startLine: 1 }] });
      expect(generateGateTests(dir, evidence, [gateCase('smell:client-side-secret-gate:x.tsx', 'open')])).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns nothing when no redirect-guard file can be found in the repo', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-gate-'));
    try {
      writeFileSync(join(dir, 'plain.tsx'), 'export function Plain() { return null; }');
      const evidence = minimalEvidence({
        routes: [
          { path: '/', file: 'page.tsx', kind: 'page', startLine: 1 },
          { path: '/home', file: 'home/page.tsx', kind: 'page', startLine: 1 }
        ]
      });
      expect(generateGateTests(dir, evidence, [gateCase('smell:client-side-secret-gate:x.tsx')])).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
