import { describe, expect, it } from 'vitest';
import { Project } from 'ts-morph';
import { dropNullCheckMutator } from '../../../../src/mutation/mutators/dropNullCheck.js';

function fileWith(source: string) {
  const project = new Project({ useInMemoryFileSystem: true });
  return project.createSourceFile('test.ts', source);
}

describe('dropNullCheckMutator', () => {
  it('finds a negation guard as a site', () => {
    const sourceFile = fileWith('if (!user) { return 404; }\n');
    const sites = dropNullCheckMutator.findSites(sourceFile, 'test.ts');
    expect(sites).toHaveLength(1);
    expect(sites[0]?.locator.startLine).toBe(1);
  });

  it('drops the negation when applied, flipping which branch runs', () => {
    const sourceFile = fileWith('if (!user) { return 404; }\n');
    const [site] = dropNullCheckMutator.findSites(sourceFile, 'test.ts');
    const applied = dropNullCheckMutator.apply(sourceFile, site!);
    expect(applied).toBe(true);
    expect(sourceFile.getFullText()).toContain('if (user) { return 404; }');
  });

  it('ignores expressions with no negation', () => {
    const sourceFile = fileWith('if (user) { return 200; }\n');
    expect(dropNullCheckMutator.findSites(sourceFile, 'test.ts')).toEqual([]);
  });
});
