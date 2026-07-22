import type { AffirmativeIntent, CodeLocator } from '../types.js';

const TODO_PATTERN = /\btodo\b/i;
const FIXME_PATTERN = /\bfixme\b/i;

export function detectTodoFixme(commentText: string, locator: CodeLocator): AffirmativeIntent | null {
  if (FIXME_PATTERN.test(commentText)) {
    return { kind: 'fixme', text: commentText.trim(), locator, confidence: 0.9 };
  }
  if (TODO_PATTERN.test(commentText)) {
    return { kind: 'todo', text: commentText.trim(), locator, confidence: 0.8 };
  }
  return null;
}
