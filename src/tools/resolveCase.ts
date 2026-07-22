import * as z from 'zod/v4';
import { resolveCaseInternal } from '../reconciliation/resolveCase.js';

export const resolveCaseInputSchema = z.object({
  repoPath: z.string().describe('Repo path whose .dossier/ this case belongs to'),
  id: z.string(),
  decision: z.string(),
  note: z.string().optional()
});

export const resolveCaseConfig = {
  description: 'Resolve one open case with a human decision. Always available, no elicitation capability required.',
  inputSchema: resolveCaseInputSchema
};

export async function resolveCaseHandler(args: z.infer<typeof resolveCaseInputSchema>) {
  const resolved = resolveCaseInternal(args.repoPath, args.id, args.decision, args.note, 'resolve_case_tool');

  if (!resolved) {
    return {
      content: [{ type: 'text' as const, text: `No open case found with id "${args.id}"` }],
      isError: true
    };
  }

  return {
    content: [{ type: 'text' as const, text: JSON.stringify(resolved, null, 2) }]
  };
}
