import { existsSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { KnownBug } from '../reconciliation/types.js';
import { knownBugsPath } from './dossierPaths.js';
import { atomicWriteFile } from './atomicWrite.js';

const STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'to', 'in', 'on', 'is', 'are', 'this', 'that',
  'and', 'or', 'it', 'its', 'for', 'with', 'as', 'be', 'by', 'at', 'when'
]);

export function tokenizeDescription(description: string): string[] {
  const tokens = description
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
  return [...new Set(tokens)];
}

export function loadKnownBugs(repoPath: string): KnownBug[] {
  const filePath = knownBugsPath(repoPath);
  if (!existsSync(filePath)) {
    return [];
  }
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf-8'));
    return Array.isArray(parsed) ? (parsed as KnownBug[]) : [];
  } catch {
    return [];
  }
}

export function addKnownBug(repoPath: string, description: string): KnownBug {
  const bug: KnownBug = {
    id: `bug-${randomUUID()}`,
    description,
    matchHints: tokenizeDescription(description),
    flaggedAt: new Date().toISOString()
  };

  const existing = loadKnownBugs(repoPath);
  atomicWriteFile(knownBugsPath(repoPath), JSON.stringify([...existing, bug], null, 2));

  return bug;
}
