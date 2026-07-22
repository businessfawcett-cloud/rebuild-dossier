import { describe, expect, it } from 'vitest';
import { jaccardSimilarity, tokenize, findNearDuplicateGroups } from '../../../src/reconciliation/nearDuplicateComponents.js';

describe('tokenize + jaccardSimilarity', () => {
  it('scores identical content as fully similar', () => {
    const a = tokenize('const SECRET_NAME = "Madeline"; function handleSubmit() {}');
    const b = tokenize('const SECRET_NAME = "Madeline"; function handleSubmit() {}');
    expect(jaccardSimilarity(a, b)).toBe(1);
  });

  it('scores completely disjoint content as zero', () => {
    const a = tokenize('const foo = 1;');
    const b = tokenize('export default function Bar() { return null; }');
    expect(jaccardSimilarity(a, b)).toBe(0);
  });

  // Calibrated against the real Madeline repo: the three actual near-duplicate
  // gate components (login-gate.tsx / -variant-a / -variant-b — same state
  // machine and handleSubmit logic, different styling) scored 0.717-0.892;
  // three genuinely unrelated real page.tsx files scored 0.063-0.113. 0.5
  // sits with a wide margin on both sides of that real, observed gap.
  it('separates near-duplicate-shaped content from unrelated content with real margin', () => {
    const gateA = tokenize(`
      "use client";
      const SECRET_NAME = "Madeline";
      export function LoginGate() {
        const [input, setInput] = useState("");
        const handleSubmit = () => {
          if (input.trim().toLowerCase() === SECRET_NAME.toLowerCase()) {
            setUnlocked();
          }
        };
        return <div className="flex min-h-screen items-center justify-center"><input onKeyDown={handleSubmit} /></div>;
      }
    `);
    const gateB = tokenize(`
      "use client";
      const SECRET_NAME = "Madeline";
      export function LoginGateA() {
        const [input, setInput] = useState("");
        const handleSubmit = () => {
          if (input.trim().toLowerCase() === SECRET_NAME.toLowerCase()) {
            setUnlocked();
          }
        };
        return <div className="relative flex min-h-screen bg-[#f5f0e8]"><input onKeyDown={handleSubmit} /></div>;
      }
    `);
    const unrelated = tokenize(`
      export default function HomePage() {
        return <main><h1>Welcome</h1><PhotoGallery items={photos} /></main>;
      }
    `);

    expect(jaccardSimilarity(gateA, gateB)).toBeGreaterThan(0.5);
    expect(jaccardSimilarity(gateA, unrelated)).toBeLessThan(0.5);
    expect(jaccardSimilarity(gateB, unrelated)).toBeLessThan(0.5);
  });
});

describe('findNearDuplicateGroups', () => {
  it('groups near-duplicate files together', () => {
    const files = [
      { path: 'login-gate.tsx', content: 'const SECRET_NAME = "Madeline"; function handleSubmit() { if (input === SECRET_NAME) { unlock(); } }' },
      {
        path: 'login-gate-variant-a.tsx',
        content: 'const SECRET_NAME = "Madeline"; function handleSubmit() { if (input === SECRET_NAME) { unlock(); } }'
      },
      { path: 'unrelated-page.tsx', content: 'export default function HomePage() { return <main>Welcome home</main>; }' }
    ];

    const groups = findNearDuplicateGroups(files);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toEqual(expect.arrayContaining(['login-gate.tsx', 'login-gate-variant-a.tsx']));
    expect(groups[0]).toHaveLength(2);
  });

  it('groups three-way near-duplicates into a single group, not three pairs', () => {
    const shared = 'const SECRET_NAME = "Madeline"; function handleSubmit() { if (input === SECRET_NAME) { unlock(); } }';
    const files = [
      { path: 'a.tsx', content: shared },
      { path: 'b.tsx', content: shared },
      { path: 'c.tsx', content: shared }
    ];

    const groups = findNearDuplicateGroups(files);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(3);
  });

  it('returns no groups when nothing is similar enough', () => {
    const files = [
      { path: 'a.tsx', content: 'export default function A() { return <div>A</div>; }' },
      { path: 'b.tsx', content: 'export function completelyDifferentLogic(x, y) { return x * y + Math.sqrt(y); }' }
    ];

    expect(findNearDuplicateGroups(files)).toEqual([]);
  });

  it('returns no groups for fewer than two files', () => {
    expect(findNearDuplicateGroups([{ path: 'a.tsx', content: 'anything' }])).toEqual([]);
    expect(findNearDuplicateGroups([])).toEqual([]);
  });
});
