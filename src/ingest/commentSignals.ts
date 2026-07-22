import { readFileSync } from 'node:fs';
import type { Signal } from '../reconciliation/types.js';
import { toPosixRelative } from '../util/paths.js';
import { lineNumberAt } from '../util/lines.js';
import { detectTodoFixme } from '../reconciliation/signalDetectors/todoFixme.js';
import { detectIntentionalComment } from '../reconciliation/signalDetectors/intentionalComment.js';

const COMMENT_PATTERN = /\/\*[\s\S]*?\*\/|\/\/.*/g;

export function extractCommentSignals(repoPath: string, filePaths: string[]): Signal[] {
  const signals: Signal[] = [];

  for (const filePath of filePaths) {
    const text = readFileSync(filePath, 'utf-8');
    const relPath = toPosixRelative(repoPath, filePath);

    for (const match of text.matchAll(COMMENT_PATTERN)) {
      const commentText = match[0];
      const startIndex = match.index ?? 0;
      const startLine = lineNumberAt(text, startIndex);
      const endLine = lineNumberAt(text, startIndex + commentText.length);
      const isDocstring = commentText.startsWith('/**') && commentText !== '/**/';
      const locator = { file: relPath, startLine, endLine };

      const intent = detectTodoFixme(commentText, locator) ?? detectIntentionalComment(commentText, locator, { isDocstring });
      if (!intent) {
        continue;
      }

      signals.push({
        id: `comment:${relPath}:${startLine}`,
        source: 'ingest',
        locator,
        topicKey: `component:${relPath}`,
        claim: commentText.trim(),
        evidenceText: commentText.trim(),
        affirmativeIntent: intent,
        detectedAt: new Date().toISOString()
      });
    }
  }

  return signals;
}
