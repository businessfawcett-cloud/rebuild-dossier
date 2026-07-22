import { Project } from 'ts-morph';
import type { MutationEngine, Mutator } from './engine.js';
import { flipComparisonMutator } from './mutators/flipComparison.js';
import { dropNullCheckMutator } from './mutators/dropNullCheck.js';
import { offByOneLoopBoundMutator } from './mutators/offByOneLoopBound.js';

const MUTATORS: Mutator[] = [flipComparisonMutator, dropNullCheckMutator, offByOneLoopBoundMutator];

// The only file that imports ts-morph directly for mutation purposes —
// everything else in mutation/ depends on the MutationEngine interface.
export const tsMorphEngine: MutationEngine = {
  enumerateSites(filePath, relFile) {
    const project = new Project({ useInMemoryFileSystem: false });
    const sourceFile = project.addSourceFileAtPath(filePath);
    return MUTATORS.flatMap((mutator) => mutator.findSites(sourceFile, relFile));
  },

  apply(filePath, site) {
    const mutator = MUTATORS.find((m) => m.name === site.mutatorName);
    if (!mutator) return false;

    const project = new Project({ useInMemoryFileSystem: false });
    const sourceFile = project.addSourceFileAtPath(filePath);
    const applied = mutator.apply(sourceFile, site);
    if (applied) {
      sourceFile.saveSync();
    }
    return applied;
  }
};
