import { describe, expect, it } from 'vitest';
import { Project } from 'ts-morph';
import { flipComparisonMutator } from '../../../../src/mutation/mutators/flipComparison.js';

function fileWith(source: string) {
  const project = new Project({ useInMemoryFileSystem: true });
  return project.createSourceFile('test.ts', source);
}

describe('flipComparisonMutator', () => {
  it('finds each comparison operator as a distinct site', () => {
    const sourceFile = fileWith('if (a === b) {}\nif (c < d) {}\n');
    const sites = flipComparisonMutator.findSites(sourceFile, 'test.ts');
    expect(sites.map((s) => s.locator.startLine)).toEqual([1, 2]);
  });

  it('flips === to !== when applied', () => {
    const sourceFile = fileWith('if (a === b) {}\n');
    const [site] = flipComparisonMutator.findSites(sourceFile, 'test.ts');
    const applied = flipComparisonMutator.apply(sourceFile, site!);
    expect(applied).toBe(true);
    expect(sourceFile.getFullText()).toContain('a !== b');
  });

  it('flips < to >= when applied', () => {
    const sourceFile = fileWith('if (i < arr.length) {}\n');
    const [site] = flipComparisonMutator.findSites(sourceFile, 'test.ts');
    flipComparisonMutator.apply(sourceFile, site!);
    expect(sourceFile.getFullText()).toContain('i >= arr.length');
  });

  it('disambiguates two comparisons on the same line via occurrenceIndex', () => {
    const sourceFile = fileWith('const ok = a === b && c === d;\n');
    const sites = flipComparisonMutator.findSites(sourceFile, 'test.ts');
    expect(sites).toHaveLength(2);
    flipComparisonMutator.apply(sourceFile, sites[1]!);
    expect(sourceFile.getFullText()).toBe('const ok = a === b && c !== d;\n');
  });

  it('ignores non-comparison binary expressions', () => {
    const sourceFile = fileWith('const sum = a + b;\n');
    expect(flipComparisonMutator.findSites(sourceFile, 'test.ts')).toEqual([]);
  });
});
