import { SyntaxKind } from 'ts-morph';
import type { Mutator, MutationSite } from '../engine.js';

function isLengthAccess(node: import('ts-morph').Node): boolean {
  return Node_isPropertyAccessExpression(node) && node.getName() === 'length';
}

// Small local guard instead of importing ts-morph's `Node` namespace object
// just for this one type check.
function Node_isPropertyAccessExpression(
  node: import('ts-morph').Node
): node is import('ts-morph').PropertyAccessExpression {
  return node.getKind() === SyntaxKind.PropertyAccessExpression;
}

function candidates(sourceFile: import('ts-morph').SourceFile) {
  return sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression).filter((node) => {
    const opText = node.getOperatorToken().getText();
    return (opText === '<' || opText === '>') && isLengthAccess(node.getRight());
  });
}

// Targets the classic `i < arr.length` loop bound and pushes it one past
// the end (`<=`), the canonical off-by-one.
export const offByOneLoopBoundMutator: Mutator = {
  name: 'off-by-one-loop-bound',

  findSites(sourceFile, file): MutationSite[] {
    const perLine = new Map<number, number>();
    return candidates(sourceFile).map((node) => {
      const line = node.getStartLineNumber();
      const occurrenceIndex = perLine.get(line) ?? 0;
      perLine.set(line, occurrenceIndex + 1);
      return {
        mutatorName: 'off-by-one-loop-bound',
        locator: { file, startLine: line, endLine: line },
        description: `off-by-one "${node.getText()}"`,
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
      const opText = node.getOperatorToken().getText();
      node.getOperatorToken().replaceWithText(opText === '<' ? '<=' : '>=');
      return true;
    }
    return false;
  }
};
