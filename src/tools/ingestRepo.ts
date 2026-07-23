import * as z from 'zod/v4';
import { ingestRepo } from '../ingest/ingestRepo.js';
import { evidencePath } from '../state/dossierPaths.js';
import { atomicWriteFile } from '../state/atomicWrite.js';
import { buildCases } from '../reconciliation/buildCases.js';
import { enforcePathAllowlist } from '../security/pathAllowlist.js';
import { findCandidateAppDirs } from '../ingest/detectMonorepoHint.js';

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

  // 0 routes is the exact, cheap symptom a real monorepo-wrapper root
  // produces (a thin package.json with no routes/build config of its own,
  // the real app one level down under apps/ or packages/) — surface it
  // directly rather than silently returning 0 and leaving someone to
  // debug their way to "point at the nested app instead."
  const monorepoCandidates = bundle.routes.length === 0 ? findCandidateAppDirs(args.path) : [];

  const summary = {
    routes: bundle.routes.length,
    existingTests: bundle.existingTests.length,
    signals: bundle.signals.length,
    buildConfig: bundle.buildConfig.map((c) => c.tool),
    openCases: cases.filter((c) => c.status === 'open').length,
    savedTo: evidencePath(args.path),
    ...(monorepoCandidates.length > 0
      ? {
          monorepoHint: {
            message:
              '0 routes were found at this exact path. This looks like a monorepo root, not the app itself — try re-running ingest_repo pointed at one of the candidates below instead.',
            candidates: monorepoCandidates
          }
        }
      : {})
  };

  return {
    content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }]
  };
}
