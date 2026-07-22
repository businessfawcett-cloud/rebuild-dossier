import { readFileSync } from 'node:fs';
import type { ExistingTestEntry, PackageJsonSummary } from './evidenceSchema.js';
import { toPosixRelative } from '../util/paths.js';

const TEST_NAME_PATTERN = /\b(?:it|test)\s*\(\s*(['"`])((?:(?!\1).)*)\1/g;

export function isTestFile(relPath: string): boolean {
  const normalized = relPath.split('\\').join('/');
  return /\.(spec|test)\.[jt]sx?$/.test(normalized) || normalized.includes('/__tests__/');
}

function detectFramework(pkg: PackageJsonSummary): string {
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const framework of ['vitest', 'jest', 'mocha']) {
    if (Object.hasOwn(allDeps, framework)) {
      return framework;
    }
  }
  return 'unknown';
}

export function scanExistingTests(repoPath: string, filePaths: string[], pkg: PackageJsonSummary): ExistingTestEntry[] {
  const framework = detectFramework(pkg);
  const entries: ExistingTestEntry[] = [];

  for (const filePath of filePaths) {
    const relPath = toPosixRelative(repoPath, filePath);
    if (!isTestFile(relPath)) continue;

    const text = readFileSync(filePath, 'utf-8');
    const testNames = [...text.matchAll(TEST_NAME_PATTERN)].map((match) => match[2]!);

    entries.push({ file: relPath, framework, testNames });
  }

  return entries;
}
