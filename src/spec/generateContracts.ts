import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RouteEntry } from '../ingest/evidenceSchema.js';

export interface GeneratedFile {
  filename: string;
  content: string;
}

// Exported so other generators (spec-auditor, verify-against-spec) can
// cross-reference the exact contract filename a route maps to, instead of
// telling an agent to go rediscover the mapping itself.
export function contractFilename(method: string | undefined, path: string): string {
  const prefix = method ?? 'PAGE';
  const pathPart = path
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join('-');
  return `${prefix}-${pathPart || 'root'}.md`;
}

function sourceLine(repoPath: string, route: RouteEntry): string {
  if (route.startLine === undefined) return '(source line unavailable)';
  const text = readFileSync(join(repoPath, route.file), 'utf-8');
  const line = text.split('\n')[route.startLine - 1];
  return line?.trim() ?? '(source line unavailable)';
}

// Extracts the real interface shape verbatim from the source — never a
// paraphrase — so the rebuild agent's contract is the actual line, not our
// summary of it.
export function generateContracts(repoPath: string, routes: RouteEntry[]): GeneratedFile[] {
  return routes.map((route) => {
    const title = route.method ? `${route.method} ${route.path}` : route.path;
    const content = [
      `# Contract: ${title}`,
      '',
      `- **File:** ${route.file}`,
      `- **Kind:** ${route.kind}`,
      route.startLine !== undefined ? `- **Line:** ${route.startLine}` : undefined,
      '',
      '## Signature (verbatim from source)',
      '',
      '```',
      sourceLine(repoPath, route),
      '```',
      ''
    ]
      .filter((line) => line !== undefined)
      .join('\n');

    return { filename: contractFilename(route.method, route.path), content };
  });
}
