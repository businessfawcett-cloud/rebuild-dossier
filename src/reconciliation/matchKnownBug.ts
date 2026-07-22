import type { KnownBug, Signal } from './types.js';

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 0)
  );
}

function signalTokens(signal: Signal): Set<string> {
  const locatorText = 'file' in signal.locator ? signal.locator.file : signal.locator.path;
  return tokenize(`${locatorText} ${signal.claim}`);
}

// Plain set intersection, no fuzzy scoring — a known bug matches a case only
// when at least one of its hint tokens literally appears in a signal's
// locator or claim text.
export function matchKnownBug(bug: KnownBug, signals: Signal[]): boolean {
  const hints = bug.matchHints.map((hint) => hint.toLowerCase());
  if (hints.length === 0) {
    return false;
  }
  return signals.some((signal) => {
    const tokens = signalTokens(signal);
    return hints.some((hint) => tokens.has(hint));
  });
}
