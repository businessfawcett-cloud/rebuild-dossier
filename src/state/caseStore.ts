import { existsSync, readFileSync } from 'node:fs';
import type { Case } from '../reconciliation/types.js';
import { casesPath } from './dossierPaths.js';
import { atomicWriteFile } from './atomicWrite.js';

export function loadCases(repoPath: string): Case[] {
  const filePath = casesPath(repoPath);
  if (!existsSync(filePath)) {
    return [];
  }
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf-8'));
    return Array.isArray(parsed) ? (parsed as Case[]) : [];
  } catch {
    return [];
  }
}

export function saveCases(repoPath: string, cases: Case[]): void {
  atomicWriteFile(casesPath(repoPath), JSON.stringify(cases, null, 2));
}
