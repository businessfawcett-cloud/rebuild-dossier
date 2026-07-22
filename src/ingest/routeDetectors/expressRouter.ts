import { readFileSync } from 'node:fs';
import type { RouteDetector } from './detector.js';
import { toPosixRelative } from '../../util/paths.js';
import { lineNumberAt } from '../../util/lines.js';

const ROUTE_CALL_PATTERN = /\b(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*(['"`])([^'"`]+)\2/g;

export const expressRouterDetector: RouteDetector = {
  name: 'express',

  applies(pkg) {
    return Object.hasOwn(pkg.dependencies, 'express');
  },

  detect(repoPath, filePaths) {
    const routes = [];
    for (const filePath of filePaths) {
      const text = readFileSync(filePath, 'utf-8');
      const relPath = toPosixRelative(repoPath, filePath);
      for (const match of text.matchAll(ROUTE_CALL_PATTERN)) {
        routes.push({
          path: match[3]!,
          method: match[1]!.toUpperCase(),
          file: relPath,
          kind: 'api' as const,
          startLine: lineNumberAt(text, match.index ?? 0)
        });
      }
    }
    return routes;
  }
};
