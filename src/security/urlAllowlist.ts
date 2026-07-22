import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { parseAllowedRoots } from './pathAllowlist.js';

export class UrlNotAllowedError extends Error {
  constructor(url: string, reason: string) {
    super(`URL is not allowed for crawling: ${url} (${reason})`);
    this.name = 'UrlNotAllowedError';
  }
}

// Blocks the classic SSRF targets: loopback, RFC1918 private ranges, and
// link-local (which includes the 169.254.169.254 cloud-metadata endpoint
// most cloud providers expose — a crawler that will fetch any URL a caller
// names is a textbook way to read a host's own cloud credentials).
export function isPrivateOrLoopbackAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b! >= 16 && b! <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 0) return true;
    return false;
  }
  if (version === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::1') return true;
    if (lower.startsWith('fe80:')) return true;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    return false;
  }
  return false;
}

function isRestrictedMode(): boolean {
  // Same signal as the path allowlist — in practice both are configured
  // together for the hosted deployment. Neither matters for local stdio
  // usage, where the calling user already trusts themselves.
  return parseAllowedRoots(process.env.REBUILD_DOSSIER_ALLOWED_PATHS).length > 0;
}

export async function enforceUrlAllowlist(rawUrl: string): Promise<void> {
  if (!isRestrictedMode()) return;

  let hostname: string;
  try {
    hostname = new URL(rawUrl).hostname;
  } catch {
    throw new UrlNotAllowedError(rawUrl, 'not a valid URL');
  }

  if (isIP(hostname) !== 0) {
    if (isPrivateOrLoopbackAddress(hostname)) {
      throw new UrlNotAllowedError(rawUrl, 'resolves to a private/loopback address');
    }
    return;
  }

  let addresses: string[];
  try {
    const results = await lookup(hostname, { all: true });
    addresses = results.map((r) => r.address);
  } catch {
    throw new UrlNotAllowedError(rawUrl, 'hostname could not be resolved');
  }

  if (addresses.some((addr) => isPrivateOrLoopbackAddress(addr))) {
    throw new UrlNotAllowedError(rawUrl, 'hostname resolves to a private/loopback address');
  }
}
