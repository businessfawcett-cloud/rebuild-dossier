import { SyntaxKind } from 'ts-morph';
import type { Mutator, MutationSite } from '../engine.js';

function candidates(sourceFile: import('ts-morph').SourceFile) {
  return sourceFile
    .getDescendantsOfKind(SyntaxKind.PrefixUnaryExpression)
    .filter((node) => node.getOperatorToken() === SyntaxKind.ExclamationToken);
}

// Targets a negation guard like `if (!user) { ... }` and drops the `!`,
// flipping which branch runs — approximates "drop a null check" broadly
// (the common shape a null/undefined guard actually takes in JS/TS).
export const dropNullCheckMutator: Mutator = {
  name: 'drop-null-check',

  findSites(sourceFile, file): MutationSite[] {
    const perLine = new Map<number, number>();
    return candidates(sourceFile).map((node) => {
      const line = node.getStartLineNumber();
      const occurrenceIndex = perLine.get(line) ?? 0;
      perLine.set(line, occurrenceIndex + 1);
      return {
        mutatorName: 'drop-null-check',
        locator: { file, startLine: line, endLine: line },
        description: `drop negation in "${node.getText()}"`,
        occurrenceIndex
      };
    });
  },

  apply(sourceFile, site): boolean {
    let index = 0;
    for (const node of candidates(sourceFile)) {
      if (node.getStartLineNumber() !== site.locator.startLine) continue;
      if (index !== site.occurrenceIndex) {
        index++;
        continue;
      }
      node.replaceWithText(node.getOperand().getText());
      return true;
    }
    return false;
  }
};
