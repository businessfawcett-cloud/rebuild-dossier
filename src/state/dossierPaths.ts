import { join } from 'node:path';

// Scratch pipeline state lives inside the target repo (per the project spec's
// own storage section), never in the sibling <repo>-rebuild/ output — the
// rebuild agent's session never has filesystem access to this directory tree.
export function dossierDir(repoPath: string): string {
  return join(repoPath, '.dossier');
}

export function evidencePath(repoPath: string): string {
  return join(dossierDir(repoPath), 'evidence.json');
}

export function crawlEvidencePath(repoPath: string): string {
  return join(dossierDir(repoPath), 'crawl.json');
}

export function knownBugsPath(repoPath: string): string {
  return join(dossierDir(repoPath), 'known-bugs.json');
}

export function casesPath(repoPath: string): string {
  return join(dossierDir(repoPath), 'cases.json');
}
