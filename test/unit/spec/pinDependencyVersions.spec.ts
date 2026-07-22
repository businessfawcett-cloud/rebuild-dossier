import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pinDependencyVersions } from '../../../src/spec/pinDependencyVersions.js';

function writeInstalledPackage(repoPath: string, name: string, version: string): void {
  const dir = join(repoPath, 'node_modules', name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, version }));
}

describe('pinDependencyVersions', () => {
  it('replaces a range with the exact installed version from node_modules', () => {
    const repoPath = mkdtempSync(join(tmpdir(), 'rebuild-dossier-pindeps-'));
    try {
      writeInstalledPackage(repoPath, 'next', '16.2.10');

      const pinned = pinDependencyVersions(repoPath, { next: '^16.0.0' });

      expect(pinned).toEqual({ next: '16.2.10' });
    } finally {
      rmSync(repoPath, { recursive: true, force: true });
    }
  });

  it('falls back to the original range when the package is not actually installed', () => {
    const repoPath = mkdtempSync(join(tmpdir(), 'rebuild-dossier-pindeps-'));
    try {
      const pinned = pinDependencyVersions(repoPath, { next: '^16.0.0' });
      expect(pinned).toEqual({ next: '^16.0.0' });
    } finally {
      rmSync(repoPath, { recursive: true, force: true });
    }
  });

  it('handles scoped packages', () => {
    const repoPath = mkdtempSync(join(tmpdir(), 'rebuild-dossier-pindeps-'));
    try {
      writeInstalledPackage(repoPath, '@react-three/fiber', '9.6.1');

      const pinned = pinDependencyVersions(repoPath, { '@react-three/fiber': '^9.0.0' });

      expect(pinned).toEqual({ '@react-three/fiber': '9.6.1' });
    } finally {
      rmSync(repoPath, { recursive: true, force: true });
    }
  });

  it('pins every dependency independently, mixing found and not-found', () => {
    const repoPath = mkdtempSync(join(tmpdir(), 'rebuild-dossier-pindeps-'));
    try {
      writeInstalledPackage(repoPath, 'react', '19.2.7');

      const pinned = pinDependencyVersions(repoPath, { react: '^19.0.0', 'left-pad': '^1.0.0' });

      expect(pinned).toEqual({ react: '19.2.7', 'left-pad': '^1.0.0' });
    } finally {
      rmSync(repoPath, { recursive: true, force: true });
    }
  });
});
