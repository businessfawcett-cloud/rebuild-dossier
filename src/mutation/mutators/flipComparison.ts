import { SyntaxKind } from 'ts-morph';
import type { Mutator, MutationSite } from '../engine.js';

const FLIP: Record<string, string> = {
  '===': '!==',
  '!==': '===',
  '==': '!=',
  '!=': '==',
  '<': '>=',
  '>=': '<',
  '>': '<=',
  '<=': '>'
};

function candidates(sourceFile: import('ts-morph').SourceFile) {
  return sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression).filter((node) => node.getOperatorToken().getText() in FLIP);
}

export const flipComparisonMutator: Mutator = {
  name: 'flip-comparison',

  findSites(sourceFile, file): MutationSite[] {
    const perLine = new Map<number, number>();
    return candidates(sourceFile).map((node) => {
      const opText = node.getOperatorToken().getText();
      const line = node.getStartLineNumber();
      const occurrenceIndex = perLine.get(line) ?? 0;
      perLine.set(line, occurrenceIndex + 1);
      return {
        mutatorName: 'flip-comparison',
        locator: { file, startLine: line, endLine: line },
        description: `flip "${opText}" to "${FLIP[opText]}"`,
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
      node.getOperatorToken().replaceWithText(FLIP[opText]!);
      return true;
    }
    return false;
  }
};
