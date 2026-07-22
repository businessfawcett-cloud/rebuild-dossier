import { existsSync, readFileSync } from 'node:fs';
import { evidenceBundleSchema, type EvidenceBundle } from '../ingest/evidenceSchema.js';
import { crawlEvidenceSchema, type CrawlEvidence } from '../crawl/crawlEvidenceSchema.js';
import { evidencePath, crawlEvidencePath } from './dossierPaths.js';

export function loadEvidenceBundle(repoPath: string): EvidenceBundle | null {
  const filePath = evidencePath(repoPath);
  if (!existsSync(filePath)) return null;
  try {
    return evidenceBundleSchema.parse(JSON.parse(readFileSync(filePath, 'utf-8')));
  } catch {
    return null;
  }
}

export function loadCrawlEvidence(repoPath: string): CrawlEvidence | null {
  const filePath = crawlEvidencePath(repoPath);
  if (!existsSync(filePath)) return null;
  try {
    return crawlEvidenceSchema.parse(JSON.parse(readFileSync(filePath, 'utf-8')));
  } catch {
    return null;
  }
}
