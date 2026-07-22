import { afterEach, describe, expect, it, vi } from 'vitest';
import { isPrivateOrLoopbackAddress, enforceUrlAllowlist, UrlNotAllowedError } from '../../../src/security/urlAllowlist.js';

const ENV_KEY = 'REBUILD_DOSSIER_ALLOWED_PATHS';
const originalValue = process.env[ENV_KEY];

describe('isPrivateOrLoopbackAddress', () => {
  it('flags loopback, link-local (incl. cloud metadata), and RFC1918 ranges', () => {
    expect(isPrivateOrLoopbackAddress('127.0.0.1')).toBe(true);
    expect(isPrivateOrLoopbackAddress('169.254.169.254')).toBe(true); // cloud metadata endpoint
    expect(isPrivateOrLoopbackAddress('10.0.0.5')).toBe(true);
    expect(isPrivateOrLoopbackAddress('172.16.0.1')).toBe(true);
    expect(isPrivateOrLoopbackAddress('172.31.255.255')).toBe(true);
    expect(isPrivateOrLoopbackAddress('192.168.1.1')).toBe(true);
    expect(isPrivateOrLoopbackAddress('0.0.0.0')).toBe(true);
    expect(isPrivateOrLoopbackAddress('::1')).toBe(true);
    expect(isPrivateOrLoopbackAddress('fe80::1')).toBe(true);
    expect(isPrivateOrLoopbackAddress('fd00::1')).toBe(true);
  });

  it('does not flag ordinary public addresses', () => {
    expect(isPrivateOrLoopbackAddress('8.8.8.8')).toBe(false);
    expect(isPrivateOrLoopbackAddress('172.32.0.1')).toBe(false); // just outside 172.16/12
    expect(isPrivateOrLoopbackAddress('2001:4860:4860::8888')).toBe(false);
  });

  it('flags IPv4-mapped IPv6 addresses that embed a private/loopback IPv4 (e.g. "http://[::ffff:127.0.0.1]/")', () => {
    expect(isPrivateOrLoopbackAddress('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateOrLoopbackAddress('::ffff:169.254.169.254')).toBe(true); // cloud metadata, mapped form
    expect(isPrivateOrLoopbackAddress('::ffff:10.0.0.5')).toBe(true);
    expect(isPrivateOrLoopbackAddress('::ffff:8.8.8.8')).toBe(false); // mapped but genuinely public
  });

  it('flags the CGNAT range 100.64.0.0/10, used by real cloud providers for metadata (e.g. Oracle Cloud)', () => {
    expect(isPrivateOrLoopbackAddress('100.64.0.1')).toBe(true);
    expect(isPrivateOrLoopbackAddress('100.100.100.200')).toBe(true);
    expect(isPrivateOrLoopbackAddress('100.127.255.255')).toBe(true);
    expect(isPrivateOrLoopbackAddress('100.63.255.255')).toBe(false); // just outside 100.64/10
    expect(isPrivateOrLoopbackAddress('100.128.0.0')).toBe(false); // just outside 100.64/10
  });
});

describe('enforceUrlAllowlist', () => {
  afterEach(() => {
    if (originalValue === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = originalValue;
    vi.restoreAllMocks();
  });

  it('does nothing when not in restricted mode (env var unset) — local/trusted usage unchanged', async () => {
    delete process.env[ENV_KEY];
    await expect(enforceUrlAllowlist('http://169.254.169.254/latest/meta-data/')).resolves.toBeUndefined();
  });

  it('rejects a URL whose host resolves to a private/loopback address once in restricted mode', async () => {
    process.env[ENV_KEY] = '/some/allowed/path';
    await expect(enforceUrlAllowlist('http://169.254.169.254/latest/meta-data/')).rejects.toThrow(UrlNotAllowedError);
    await expect(enforceUrlAllowlist('http://127.0.0.1:8080/')).rejects.toThrow(UrlNotAllowedError);
  });

  it('allows an ordinary public URL once in restricted mode', async () => {
    process.env[ENV_KEY] = '/some/allowed/path';
    await expect(enforceUrlAllowlist('http://93.184.216.34/')).resolves.toBeUndefined(); // literal public IP, no DNS needed
  });

  it('rejects a malformed URL rather than throwing an unrelated error', async () => {
    process.env[ENV_KEY] = '/some/allowed/path';
    await expect(enforceUrlAllowlist('not a url')).rejects.toThrow(UrlNotAllowedError);
  });
});
