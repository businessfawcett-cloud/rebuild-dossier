import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EvidenceBundle, RouteEntry } from '../ingest/evidenceSchema.js';
import type { Case } from '../reconciliation/types.js';
import type { GeneratedFile } from './generateContracts.js';

const HELD_OUT_EVERY = 3; // deterministic split, not random — see generateTests below

function findAppExport(repoPath: string, files: string[]): { file: string; exportName: string } | null {
  for (const file of files) {
    const fullPath = join(repoPath, file);
    if (!existsSync(fullPath)) continue;
    const text = readFileSync(fullPath, 'utf-8');
    const match = text.match(/export\s+default\s+(\w+)/);
    if (match) return { file, exportName: match[1]! };
  }
  return null;
}

function importPathFor(appFile: string): string {
  // Tests live at <rebuild>/tests/visible|held-out/<name>.spec.ts — two
  // directories up reaches <rebuild>/, then into the mirrored source path.
  return `../../${appFile.replace(/\.tsx?$/, '.js')}`;
}

function concretePath(path: string): string {
  return path.replace(/:[^/]+/g, 'test-value-123');
}

function parseExpectedStatus(claim: string): number | null {
  const match = claim.match(/\b([1-5]\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function reconciliationAssertion(route: RouteEntry, cases: Case[]): { claim: string; status: number } | null {
  const topicKey = `route:${route.method ?? 'GET'}:${route.path}`;
  const kase = cases.find((c) => c.topicKey === topicKey);
  if (!kase) return null;

  const decision = kase.autoResolution?.decision ?? kase.humanDecision?.decision;
  if (decision !== 'intentional') return null; // unknown correct value for a case resolved as a bug — don't fabricate

  for (const signal of kase.signals) {
    const status = parseExpectedStatus(signal.claim);
    if (status !== null) {
      return { claim: signal.claim, status };
    }
  }
  return null;
}

function testFileFor(route: RouteEntry, importPath: string, cases: Case[]): string {
  const method = route.method ?? 'GET';
  const concrete = concretePath(route.path);
  const reconciliation = reconciliationAssertion(route, cases);

  const tests = [
    `  it('responds without crashing (from-repo contract)', async () => {
    const res = await fetch(\`\${baseUrl}${concrete}\`, { method: '${method}' });
    expect(res.status).toBeLessThan(500);
  });`
  ];

  if (reconciliation) {
    tests.push(
      `  it(${JSON.stringify(`${reconciliation.claim} (from-reconciliation)`)}, async () => {
    const res = await fetch(\`\${baseUrl}${concrete}\`, { method: '${method}' });
    expect(res.status).toBe(${reconciliation.status});
  });`
    );
  }

  return `import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'node:http';
import app from '${importPath}';

let server;
let baseUrl;

beforeAll(async () => {
  server = createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = \`http://127.0.0.1:\${server.address().port}\`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(() => resolve()));
});

describe(${JSON.stringify(`${method} ${route.path}`)}, () => {
${tests.join('\n\n')}
});
`;
}

function sanitizeFilenameBase(method: string | undefined, path: string): string {
  const prefix = method ?? 'PAGE';
  const pathPart = path
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join('-');
  return `${prefix}-${pathPart || 'root'}`;
}

export interface GeneratedTestFile extends GeneratedFile {
  sourceFile: string; // original repo's file the mutation check should mutate
  coveredRouteFiles?: string[]; // route/contract files this test actually exercises, for
  // contract-coverage tracking — usually the same as sourceFile (true for
  // every Express test here), but NOT always: a gate test's sourceFile is
  // the original app's guard mechanism, while the routes it behaviorally
  // covers (and a rebuild agent must still build) can be entirely different
  // files. Falls back to [sourceFile] when absent.
}

export function generateTests(
  repoPath: string,
  evidence: EvidenceBundle,
  cases: Case[]
): { visible: GeneratedTestFile[]; heldOut: GeneratedTestFile[] } {
  const apiRoutes = evidence.routes.filter((r) => r.kind === 'api');
  if (apiRoutes.length === 0 || !Object.hasOwn(evidence.packageJson.dependencies, 'express')) {
    return { visible: [], heldOut: [] };
  }

  const appExport = findAppExport(repoPath, [...new Set(apiRoutes.map((r) => r.file))]);
  if (!appExport) {
    return { visible: [], heldOut: [] };
  }
  const importPath = importPathFor(appExport.file);

  const visible: GeneratedTestFile[] = [];
  const heldOut: GeneratedTestFile[] = [];

  apiRoutes.forEach((route, index) => {
    const file: GeneratedTestFile = {
      filename: `${sanitizeFilenameBase(route.method, route.path)}.spec.ts`,
      content: testFileFor(route, importPath, cases),
      sourceFile: route.file
    };
    if (index % HELD_OUT_EVERY === HELD_OUT_EVERY - 1) {
      heldOut.push(file);
    } else {
      visible.push(file);
    }
  });

  return { visible, heldOut };
}
