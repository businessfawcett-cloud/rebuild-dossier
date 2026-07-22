import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { enforcePathAllowlist } from '../../../src/security/pathAllowlist.js';
import { PathNotAllowedError } from '../../../src/security/pathAllowlist.js';

const ENV_KEY = 'REBUILD_DOSSIER_ALLOWED_PATHS';
const originalValue = process.env[ENV_KEY];

describe('enforcePathAllowlist', () => {
  afterEach(() => {
    if (originalValue === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = originalValue;
  });

  it('does not restrict anything when the env var is unset (local/trusted stdio usage, unchanged behavior)', () => {
    delete process.env[ENV_KEY];
    expect(() => enforcePathAllowlist(resolve('/anything/at/all'))).not.toThrow();
  });

  it('enforces the allowlist once the env var is set', () => {
    process.env[ENV_KEY] = resolve('/allowed/projects');
    expect(() => enforcePathAllowlist(resolve('/allowed/projects/my-app'))).not.toThrow();
    expect(() => enforcePathAllowlist(resolve('/etc/passwd'))).toThrow(PathNotAllowedError);
  });
});
