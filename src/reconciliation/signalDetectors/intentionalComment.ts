import type { AffirmativeIntent, CodeLocator } from '../types.js';

// Conservative on purpose: only phrases that state an actual reason count.
// A missed match just becomes a human question (cheap); a false positive
// would silently auto-resolve something nobody actually decided (expensive).
const INTENT_PATTERNS = [/\bintentional(ly)?\b/i, /\bby design\b/i, /\bdeliberately\b/i, /\bon purpose\b/i];

export interface DetectIntentionalCommentOptions {
  isDocstring?: boolean;
}

export function detectIntentionalComment(
  commentText: string,
  locator: CodeLocator,
  options: DetectIntentionalCommentOptions = {}
): AffirmativeIntent | null {
  const matches = INTENT_PATTERNS.some((pattern) => pattern.test(commentText));
  if (!matches) {
    return null;
  }
  return {
    kind: options.isDocstring ? 'docstring' : 'comment',
    text: commentText.trim(),
    locator,
    confidence: 0.8
  };
}
