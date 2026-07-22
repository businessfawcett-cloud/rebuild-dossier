import * as z from 'zod/v4';
import type { ServerContext } from '@modelcontextprotocol/server';
import { crawlSite } from '../crawl/crawler.js';
import { createProgressReporter } from '../crawl/progressHeartbeat.js';
import { crawlEvidencePath } from '../state/dossierPaths.js';
import { atomicWriteFile } from '../state/atomicWrite.js';
import { buildCases } from '../reconciliation/buildCases.js';

export const crawlSiteInputSchema = z.object({
  url: z.string().describe('Base URL to crawl'),
  maxPages: z.number().int().positive().optional(),
  repoPath: z.string().describe('Repo path whose .dossier/ this crawl evidence should be saved under')
});

export const crawlSiteConfig = {
  description: 'Playwright headless crawl of reachable routes. Emits periodic progress notifications.',
  inputSchema: crawlSiteInputSchema
};

export async function crawlSiteHandler(args: z.infer<typeof crawlSiteInputSchema>, ctx: ServerContext) {
  const evidence = await crawlSite(args.url, {
    maxPages: args.maxPages,
    onProgress: createProgressReporter(ctx),
    signal: ctx.mcpReq.signal
  });

  atomicWriteFile(crawlEvidencePath(args.repoPath), JSON.stringify(evidence, null, 2));
  const cases = buildCases(args.repoPath);

  const summary = {
    routesVisited: evidence.routesVisited.length,
    routesWithConsoleErrors: evidence.routesVisited.filter((r) => r.consoleErrors.length > 0).length,
    openCases: cases.filter((c) => c.status === 'open').length,
    savedTo: crawlEvidencePath(args.repoPath)
  };

  return {
    content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }]
  };
}
