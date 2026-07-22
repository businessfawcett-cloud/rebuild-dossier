import type { PackageJsonSummary, RouteEntry } from '../evidenceSchema.js';

export interface RouteDetector {
  name: string;
  applies(pkg: PackageJsonSummary): boolean;
  detect(repoPath: string, filePaths: string[]): RouteEntry[];
}
