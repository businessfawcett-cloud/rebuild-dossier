import * as z from 'zod/v4';
import { signalSchema } from '../reconciliation/types.js';

export const routeVisitSchema = z.object({
  url: z.string(),
  status: z.number().int(),
  consoleErrors: z.array(z.string())
});
export type RouteVisit = z.infer<typeof routeVisitSchema>;

export const crawlEvidenceSchema = z.object({
  baseUrl: z.string(),
  generatedAt: z.string(),
  routesVisited: z.array(routeVisitSchema),
  signals: z.array(signalSchema)
});
export type CrawlEvidence = z.infer<typeof crawlEvidenceSchema>;
