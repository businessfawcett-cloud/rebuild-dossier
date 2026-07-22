import { describe, expect, it } from 'vitest';
import { join, resolve } from 'node:path';
import { isPathAllowed, assertPathAllowed, PathNotAllowedError, parseAllowedRoots } from '../../../src/security/pathAllowlist.js';

describe('isPathAllowed', () => {
  const root = resolve('/allowed/projects');

  it('allows a path nested inside an allowed root', () => {
    expect(isPathAllowed(join(root, 'my-app'), [root])).toBe(true);
    expect(isPathAllowed(join(root, 'my-app', 'src', 'index.ts'), [root])).toBe(true);
  });

  it('allows the root itself', () => {
    expect(isPathAllowed(root, [root])).toBe(true);
  });

  it('rejects a path outside every allowed root', () => {
    expect(isPathAllowed(resolve('/etc/passwd'), [root])).toBe(false);
    expect(isPathAllowed(resolve('/somewhere/else'), [root])).toBe(false);
  });

  it('rejects a sibling directory whose name merely starts with the root\'s name (prefix confusion)', () => {
    // /allowed/projects-evil must NOT be considered inside /allowed/projects
    const sibling = resolve('/allowed/projects-evil');
    expect(isPathAllowed(sibling, [root])).toBe(false);
  });

  it('rejects a path that escapes the root via ../ segments', () => {
    const escaping = join(root, '..', '..', 'etc', 'passwd');
    expect(isPathAllowed(escaping, [root])).toBe(false);
  });

  it('allows a path matching any one of multiple allowed roots', () => {
    const rootB = resolve('/other/allowed');
    expect(isPathAllowed(join(rootB, 'thing'), [root, rootB])).toBe(true);
  });

  it('rejects everything when there are no allowed roots configured', () => {
    expect(isPathAllowed(join(root, 'my-app'), [])).toBe(false);
  });
});

describe('assertPathAllowed', () => {
  const root = resolve('/allowed/projects');

  it('does not throw for an allowed path', () => {
    expect(() => assertPathAllowed(join(root, 'my-app'), [root])).not.toThrow();
  });

  it('throws PathNotAllowedError for a disallowed path, naming the path but not the full allowlist', () => {
    try {
      assertPathAllowed(resolve('/etc/passwd'), [root]);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(PathNotAllowedError);
      expect((err as Error).message).toContain(resolve('/etc/passwd'));
    }
  });
});

describe('parseAllowedRoots', () => {
  it('splits a comma-separated env value into resolved absolute paths', () => {
    const raw = `${resolve('/a/b')},${resolve('/c/d')}`;
    expect(parseAllowedRoots(raw)).toEqual([resolve('/a/b'), resolve('/c/d')]);
  });

  it('trims whitespace and drops empty entries', () => {
    const raw = `  ${resolve('/a/b')} , , ${resolve('/c/d')}  `;
    expect(parseAllowedRoots(raw)).toEqual([resolve('/a/b'), resolve('/c/d')]);
  });

  it('returns an empty array for undefined/empty input', () => {
    expect(parseAllowedRoots(undefined)).toEqual([]);
    expect(parseAllowedRoots('')).toEqual([]);
  });
});
