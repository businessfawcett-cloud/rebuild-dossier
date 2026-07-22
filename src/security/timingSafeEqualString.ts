import { timingSafeEqual } from 'node:crypto';

// A plain `===` comparison leaks how many leading characters matched via
// response timing — irrelevant for most code, but this exists specifically
// to compare a caller-supplied bearer token against the configured secret.
// Deliberately treats an empty string as never matching anything (including
// another empty string) — a defense against an accidentally-unset secret
// silently becoming "always valid".
export function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length === 0 || b.length === 0) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
