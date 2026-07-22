import * as z from 'zod/v4';
import { addKnownBug } from '../state/knownBugs.js';
import { buildCases } from '../reconciliation/buildCases.js';

export const flagKnownBugInputSchema = z.object({
  repoPath: z.string().describe('Repo path whose .dossier/ this known bug belongs to'),
  description: z.string().describe('Free-text description of a known bug, stored verbatim')
});

export const flagKnownBugConfig = {
  description:
    'Record a known bug. Always overrides auto-resolve for any case it matches, regardless of other evidence.',
  inputSchema: flagKnownBugInputSchema
};

export async function flagKnownBugHandler(args: z.infer<typeof flagKnownBugInputSchema>) {
  const bug = addKnownBug(args.repoPath, args.description);
  // Recompute cases immediately so this override takes effect right away,
  // rather than waiting for the next unrelated ingest/crawl call.
  const cases = buildCases(args.repoPath);

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          { bug, openCases: cases.filter((c) => c.status === 'open').length },
          null,
          2
        )
      }
    ]
  };
}
