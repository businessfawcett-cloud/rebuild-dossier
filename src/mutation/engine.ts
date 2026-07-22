export interface MutationSite {
  mutatorName: string;
  locator: { file: string; startLine: number; endLine: number };
  description: string;
  occurrenceIndex: number;
}

export interface MutationEngine {
  enumerateSites(filePath: string, relFile: string): MutationSite[];
  apply(filePath: string, site: MutationSite): boolean;
}

// A Mutator operates on an already-parsed ts-morph SourceFile — the engine
// owns parsing/saving, so a mutator is a small, independently testable pure
// function pair with no filesystem access of its own.
export interface Mutator {
  name: string;
  findSites(sourceFile: import('ts-morph').SourceFile, file: string): MutationSite[];
  apply(sourceFile: import('ts-morph').SourceFile, site: MutationSite): boolean;
}
