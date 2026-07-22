import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clientSideSecretGateDetector } from '../../../../src/ingest/smellDetectors/clientSideSecretGate.js';

function writeFixture(dir: string, name: string, content: string) {
  const full = join(dir, name);
  writeFileSync(full, content);
  return full;
}

describe('clientSideSecretGateDetector', () => {
  it('flags a client component that compares user input against a hardcoded secret-like constant', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-smell-'));
    try {
      const file = writeFixture(
        dir,
        'login-gate.tsx',
        [
          '"use client";',
          '',
          'const SECRET_NAME = "Madeline";',
          '',
          'export function LoginGate() {',
          '  const handleSubmit = () => {',
          '    if (input.trim().toLowerCase() === SECRET_NAME.toLowerCase()) {',
          '      setUnlocked();',
          '    }',
          '  };',
          '}'
        ].join('\n')
      );

      const signals = clientSideSecretGateDetector.detect(dir, [file]);

      expect(signals).toHaveLength(1);
      expect(signals[0]?.affirmativeIntent).toBeUndefined();
      expect(signals[0]?.claim).toContain('client-side');
      expect(signals[0]?.claim).toContain('SECRET_NAME');
      expect(signals[0]?.topicKey).toBe('smell:client-side-secret-gate:login-gate.tsx');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not flag a file with no "use client" directive (server-side comparison is a different concern)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-smell-'));
    try {
      const file = writeFixture(
        dir,
        'auth.ts',
        ['const SECRET_TOKEN = process.env.API_SECRET;', 'if (input === SECRET_TOKEN) { grant(); }'].join('\n')
      );
      expect(clientSideSecretGateDetector.detect(dir, [file])).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not flag a client component with no secret-like identifier at all', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-smell-'));
    try {
      const file = writeFixture(
        dir,
        'greeting.tsx',
        ['"use client";', '', 'export function Greeting({ name }: { name: string }) {', '  return <p>Hello {name}</p>;', '}'].join(
          '\n'
        )
      );
      expect(clientSideSecretGateDetector.detect(dir, [file])).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not flag a secret-like constant that is declared but never compared against anything', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-smell-'));
    try {
      const file = writeFixture(
        dir,
        'unused.tsx',
        ['"use client";', '', 'const PASSWORD_HINT = "your pet\'s name";', '', 'export function Hint() { return null; }'].join('\n')
      );
      expect(clientSideSecretGateDetector.detect(dir, [file])).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
