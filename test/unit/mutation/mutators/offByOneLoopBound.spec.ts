import { describe, expect, it } from 'vitest';
import { Project } from 'ts-morph';
import { offByOneLoopBoundMutator } from '../../../../src/mutation/mutators/offByOneLoopBound.js';

function fileWith(source: string) {
  const project = new Project({ useInMemoryFileSystem: true });
  return project.createSourceFile('test.ts', source);
}

describe('offByOneLoopBoundMutator', () => {
  it('finds a "< x.length" loop bound as a site', () => {
    const sourceFile = fileWith('for (let i = 0; i < arr.length; i++) {}\n');
    const sites = offByOneLoopBoundMutator.findSites(sourceFile, 'test.ts');
    expect(sites).toHaveLength(1);
  });

  it('off-by-ones the bound to <= when applied', () => {
    const sourceFile = fileWith('for (let i = 0; i < arr.length; i++) {}\n');
    const [site] = offByOneLoopBoundMutator.findSites(sourceFile, 'test.ts');
    offByOneLoopBoundMutator.apply(sourceFile, site!);
    expect(sourceFile.getFullText()).toContain('i <= arr.length');
  });

  it('ignores comparisons that are not against a .length property', () => {
    const sourceFile = fileWith('for (let i = 0; i < max; i++) {}\n');
    expect(offByOneLoopBoundMutator.findSites(sourceFile, 'test.ts')).toEqual([]);
  });
});
