import { describe, expect, it } from 'vitest';
import { timingSafeEqualString } from '../../../src/security/timingSafeEqualString.js';

describe('timingSafeEqualString', () => {
  it('returns true for identical strings', () => {
    expect(timingSafeEqualString('secret-token-123', 'secret-token-123')).toBe(true);
  });

  it('returns false for different strings of the same length', () => {
    expect(timingSafeEqualString('secret-token-123', 'secret-token-124')).toBe(false);
  });

  it('returns false for different-length strings without throwing', () => {
    expect(timingSafeEqualString('short', 'a-much-longer-string')).toBe(false);
  });

  it('returns false when either string is empty', () => {
    expect(timingSafeEqualString('', 'x')).toBe(false);
    expect(timingSafeEqualString('x', '')).toBe(false);
    expect(timingSafeEqualString('', '')).toBe(false);
  });
});
