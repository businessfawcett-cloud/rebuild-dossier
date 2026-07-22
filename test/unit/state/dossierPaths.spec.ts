import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { dossierDir, evidencePath, crawlEvidencePath, knownBugsPath, casesPath } from '../../../src/state/dossierPaths.js';

describe('dossierPaths', () => {
  const repoPath = join('D:', 'some-app');

  it('places .dossier inside the target repo, never a sibling directory', () => {
    expect(dossierDir(repoPath)).toBe(join(repoPath, '.dossier'));
  });

  it('derives each state file path under .dossier', () => {
    expect(evidencePath(repoPath)).toBe(join(repoPath, '.dossier', 'evidence.json'));
    expect(crawlEvidencePath(repoPath)).toBe(join(repoPath, '.dossier', 'crawl.json'));
    expect(knownBugsPath(repoPath)).toBe(join(repoPath, '.dossier', 'known-bugs.json'));
    expect(casesPath(repoPath)).toBe(join(repoPath, '.dossier', 'cases.json'));
  });
});
