import * as z from 'zod/v4';

export const codeLocatorSchema = z.object({
  file: z.string(),
  startLine: z.number().int(),
  endLine: z.number().int()
});
export type CodeLocator = z.infer<typeof codeLocatorSchema>;

export const routeLocatorSchema = z.object({
  path: z.string(),
  method: z.string().optional()
});
export type RouteLocator = z.infer<typeof routeLocatorSchema>;

export const locatorSchema = z.union([codeLocatorSchema, routeLocatorSchema]);
export type Locator = z.infer<typeof locatorSchema>;

export const affirmativeIntentKindSchema = z.enum(['comment', 'docstring', 'todo', 'fixme']);
export type AffirmativeIntentKind = z.infer<typeof affirmativeIntentKindSchema>;

export const affirmativeIntentSchema = z.object({
  kind: affirmativeIntentKindSchema,
  text: z.string(),
  locator: codeLocatorSchema,
  confidence: z.number().min(0).max(1)
});
export type AffirmativeIntent = z.infer<typeof affirmativeIntentSchema>;

export const signalSourceSchema = z.enum(['ingest', 'crawl', 'known_bug']);
export type SignalSource = z.infer<typeof signalSourceSchema>;

export const signalSchema = z.object({
  id: z.string(),
  source: signalSourceSchema,
  locator: locatorSchema,
  topicKey: z.string(),
  claim: z.string(),
  evidenceText: z.string(),
  affirmativeIntent: affirmativeIntentSchema.optional(),
  detectedAt: z.string()
});
export type Signal = z.infer<typeof signalSchema>;

export const knownBugSchema = z.object({
  id: z.string(),
  description: z.string(),
  matchHints: z.array(z.string()),
  flaggedAt: z.string()
});
export type KnownBug = z.infer<typeof knownBugSchema>;

export const caseStatusSchema = z.enum(['auto_resolved', 'open', 'resolved_by_human']);
export type CaseStatus = z.infer<typeof caseStatusSchema>;

export const autoResolutionSchema = z.object({
  decision: z.enum(['intentional', 'bug']),
  reason: z.string()
});
export type AutoResolution = z.infer<typeof autoResolutionSchema>;

export const humanDecisionSchema = z.object({
  decision: z.string(),
  note: z.string().optional(),
  decidedAt: z.string(),
  via: z.enum(['elicitation', 'resolve_case_tool'])
});
export type HumanDecision = z.infer<typeof humanDecisionSchema>;

export const conflictKindSchema = z.enum(['known_bug_vs_intentional_evidence', 'signal_disagreement']);
export type ConflictKind = z.infer<typeof conflictKindSchema>;

export const conflictSchema = z.object({
  kind: conflictKindSchema,
  detail: z.string()
});
export type Conflict = z.infer<typeof conflictSchema>;

export const caseSchema = z.object({
  id: z.string(),
  topicKey: z.string(),
  signals: z.array(signalSchema),
  matchedKnownBugs: z.array(z.string()),
  status: caseStatusSchema,
  autoResolution: autoResolutionSchema.optional(),
  humanDecision: humanDecisionSchema.optional(),
  conflict: conflictSchema.optional(),
  // Other cases whose source file is a near-content-duplicate of this one's —
  // resolving this case may need to apply to those too. Populated by
  // buildCases, not by classifyCase itself (it's cross-case, not per-case).
  relatedCaseIds: z.array(z.string()).optional()
});
export type Case = z.infer<typeof caseSchema>;
