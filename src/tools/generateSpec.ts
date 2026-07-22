import * as z from 'zod/v4';
import { dirname, basename, join } from 'node:path';
import { loadCases } from '../state/caseStore.js';
import { loadEvidenceBundle } from '../state/evidenceStore.js';
import { writeSpecTree } from '../spec/writeSpecTree.js';
import { enforcePathAllowlist } from '../security/pathAllowlist.js';

export const generateSpecInputSchema = z.object({
  repoPath: z.string().describe('Repo path that was ingested; output is written to a sibling <repoPath>-rebuild/ directory')
});

export const generateSpecConfig = {
  description:
    'Write CLAUDE.md, .claude/, spec/, tests/, and kickoff-prompt.txt to <repo>-rebuild/. Only callable once the case queue is empty.',
  inputSchema: generateSpecInputSchema
};

function siblingRebuildDir(repoPath: string): string {
  return join(dirname(repoPath), `${basename(repoPath)}-rebuild`);
}

export async function generateSpecHandler(args: z.infer<typeof generateSpecInputSchema>) {
  enforcePathAllowlist(args.repoPath);
  // The sibling <repo>-rebuild/ output dir is a write target in its own
  // right, and — unlike ingest_repo's reads — isn't necessarily inside
  // repoPath itself (it's a sibling, not a child), so an allowlist scoped to
  // one exact repo rather than its parent directory wouldn't otherwise cover it.
  enforcePathAllowlist(siblingRebuildDir(args.repoPath));

  const openCases = loadCases(args.repoPath).filter((c) => c.status === 'open');
  if (openCases.length > 0) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Cannot generate spec: ${openCases.length} case(s) still open. Resolve them via get_case_queue/resolve_case first.`
        }
      ],
      isError: true
    };
  }

  const evidence = loadEvidenceBundle(args.repoPath);
  if (!evidence) {
    return {
      content: [{ type: 'text' as const, text: `No evidence found for ${args.repoPath} — run ingest_repo first.` }],
      isError: true
    };
  }

  const outputDir = siblingRebuildDir(args.repoPath);
  const cases = loadCases(args.repoPath);
  const { mutationReport } = writeSpecTree({ repoPath: args.repoPath, outputDir, evidence, cases });

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            outputDir,
            mutationsChecked: mutationReport.results.length,
            weakTests: mutationReport.weakTestFiles
          },
          null,
          2
        )
      }
    ]
  };
}
