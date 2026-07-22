import { readFileSync } from 'node:fs';
import type { SmellDetector } from './detector.js';
import type { Signal } from '../../reconciliation/types.js';
import { toPosixRelative } from '../../util/paths.js';
import { lineNumberAt } from '../../util/lines.js';

const USE_CLIENT_PATTERN = /^\s*["']use client["'];?\s*$/m;
const SECRET_CONST_PATTERN = /\bconst\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*(?::\s*[^=]+)?=\s*["'`]([^"'`]*)["'`]/g;
const SECRET_NAME_PATTERN = /secret|password|passcode|pin\b/i;

export interface SecretConst {
  name: string;
  value: string;
  declLine: number;
}

// Shared with generateGateTests.ts, which needs the actual secret value (not
// just its name) to simulate typing the correct/incorrect answer.
export function findSecretConst(text: string): SecretConst | null {
  for (const match of text.matchAll(SECRET_CONST_PATTERN)) {
    const name = match[1]!;
    if (!SECRET_NAME_PATTERN.test(name)) continue;
    return { name, value: match[2]!, declLine: lineNumberAt(text, match.index ?? 0) };
  }
  return null;
}

function findComparisonUsage(text: string, name: string, declLine: number): { line: number; text: string } | null {
  const nameRegex = new RegExp(`\\b${name}\\b`);
  const comparisonRegex = /===|==/;
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    if (lineNo === declLine) continue;
    const line = lines[i]!;
    if (nameRegex.test(line) && comparisonRegex.test(line)) {
      return { line: lineNo, text: line.trim() };
    }
  }
  return null;
}

// Nobody comments on a hardcoded client-side secret check — that's exactly
// why it's invisible to comment-scanning. This detector proactively
// generates a candidate signal from the pattern itself: a "use client"
// file that compares user input against a hardcoded, secret-shaped
// constant. Deliberately biased toward recall over precision here — unlike
// affirmative-intent detection (where a false positive silently
// auto-resolves something wrong), a false-positive smell just becomes one
// more question a human can dismiss. A missed smell is silence, which is
// exactly the failure mode this detector exists to close.
export const clientSideSecretGateDetector: SmellDetector = {
  name: 'client-side-secret-gate',

  detect(repoPath, filePaths) {
    const signals: Signal[] = [];

    for (const filePath of filePaths) {
      const text = readFileSync(filePath, 'utf-8');
      if (!USE_CLIENT_PATTERN.test(text)) continue;

      const relPath = toPosixRelative(repoPath, filePath);

      for (const match of text.matchAll(SECRET_CONST_PATTERN)) {
        const name = match[1]!;
        if (!SECRET_NAME_PATTERN.test(name)) continue;

        const declLine = lineNumberAt(text, match.index ?? 0);
        const usage = findComparisonUsage(text, name, declLine);
        if (!usage) continue;

        signals.push({
          id: `smell:client-side-secret-gate:${relPath}`,
          source: 'ingest',
          locator: { file: relPath, startLine: usage.line, endLine: usage.line },
          topicKey: `smell:client-side-secret-gate:${relPath}`,
          claim: `Possible client-side-only credential gate: compares user input against a hardcoded constant ("${name}") entirely in client code ("use client"), with no server-side verification detected in this file.`,
          evidenceText: usage.text,
          detectedAt: new Date().toISOString()
        });
        break; // one signal per file is enough to raise the question
      }
    }

    return signals;
  }
};
