import * as z from 'zod/v4';
import { ingestRepo } from '../ingest/ingestRepo.js';
import { evidencePath } from '../state/dossierPaths.js';
import { atomicWriteFile } from '../state/atomicWrite.js';
import { buildCases } from '../reconciliation/buildCases.js';
import { enforcePathAllowlist } from '../security/pathAllowlist.js';

export const ingestRepoInputSchema = z.object({
  path: z.string().describe('Absolute path to the repo to ingest')
});

export const ingestRepoConfig = {
  description:
    'Parse package.json, tailwind/vite config, route files, and existing tests via static analysis. No LLM call.',
  inputSchema: ingestRepoInputSchema
};

export async function ingestRepoHandler(args: z.infer<typeof ingestRepoInputSchema>) {
  enforcePathAllowlist(args.path);
  const bundle = await ingestRepo(args.path);
  atomicWriteFile(evidencePath(args.path), JSON.stringify(bundle, null, 2));
  const cases = buildCases(args.path);

  const summary = {
    routes: bundle.routes.length,
    existingTests: bundle.existingTests.length,
    signals: bundle.signals.length,
    buildConfig: bundle.buildConfig.map((c) => c.tool),
    openCases: cases.filter((c) => c.status === 'open').length,
    savedTo: evidencePath(args.path)
  };

  return {
    content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }]
  };
}
