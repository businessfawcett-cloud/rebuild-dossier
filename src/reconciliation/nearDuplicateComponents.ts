// Real, observed gap from the Madeline validation: three near-duplicate gate
// components (login-gate.tsx, -variant-a, -variant-b) each produced their own
// independent case-file entry with zero cross-reference between them — an
// agent (or a human skimming the case queue) had no signal that resolving one
// might mean the same decision applies to the others. Deliberately content-
// based, not filename-based ("variant-a"/"variant-b" is exactly the kind of
// naming hint a real app won't reliably provide) — two files are flagged as
// near-duplicates purely by how similar their tokens are, so an app that
// names near-identical components completely differently still gets caught.
//
// Threshold calibrated against real data, not guessed: the three actual
// Madeline gate variants scored 0.717-0.892 against each other; three
// genuinely unrelated real page.tsx files from the same repo scored
// 0.063-0.113. 0.5 sits with a wide margin on both sides of that real gap.
const SIMILARITY_THRESHOLD = 0.5;

export function tokenize(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/[a-z_$][a-z0-9_$]*/g) ?? []);
}

export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export interface CandidateFile {
  path: string;
  content: string;
}

// Union-find, same shape as clusterTestsByFile — a chain of pairwise-similar
// files (A~B, B~C) collapses into one group of three, not two overlapping
// pairs, since a human resolving "these look related" wants one prompt
// covering all of them, not a fragmented series of partial overlaps.
export function findNearDuplicateGroups(files: CandidateFile[]): string[][] {
  if (files.length < 2) return [];

  const parent = new Map<string, string>();
  function find(x: string): string {
    let root = x;
    while (parent.get(root) !== undefined && parent.get(root) !== root) {
      root = parent.get(root)!;
    }
    return root;
  }
  function union(a: string, b: string): void {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootA, rootB);
  }

  for (const file of files) {
    parent.set(file.path, file.path);
  }

  const tokenSets = files.map((f) => tokenize(f.content));
  for (let i = 0; i < files.length; i++) {
    for (let j = i + 1; j < files.length; j++) {
      if (jaccardSimilarity(tokenSets[i]!, tokenSets[j]!) >= SIMILARITY_THRESHOLD) {
        union(files[i]!.path, files[j]!.path);
      }
    }
  }

  const groups = new Map<string, Set<string>>();
  for (const file of files) {
    const root = find(file.path);
    if (!groups.has(root)) groups.set(root, new Set());
    groups.get(root)!.add(file.path);
  }

  return [...groups.values()].map((g) => [...g]).filter((g) => g.length >= 2);
}
