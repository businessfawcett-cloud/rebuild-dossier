import { describe, expect, it } from 'vitest';
import { detectIntentionalComment } from '../../../../src/reconciliation/signalDetectors/intentionalComment.js';

const locator = { file: 'src/foo.ts', startLine: 1, endLine: 1 };

describe('detectIntentionalComment', () => {
  it('detects an explicit "intentional" comment', () => {
    const intent = detectIntentionalComment(
      '// intentional: we allow duplicates here to keep insertion order',
      locator
    );
    expect(intent).not.toBeNull();
    expect(intent?.kind).toBe('comment');
    expect(intent?.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('detects "by design"', () => {
    expect(detectIntentionalComment('// returns duplicates by design', locator)).not.toBeNull();
  });

  it('detects "deliberately"', () => {
    expect(detectIntentionalComment('// deliberately skips validation here', locator)).not.toBeNull();
  });

  it('marks kind as docstring when isDocstring is passed', () => {
    const intent = detectIntentionalComment('/** on purpose: legacy clients expect this shape */', locator, {
      isDocstring: true
    });
    expect(intent?.kind).toBe('docstring');
  });

  it('does NOT match a generic weak note with no stated reason (conservative by design)', () => {
    expect(detectIntentionalComment('// note: this seems weird', locator)).toBeNull();
  });

  it('returns null for a plain descriptive comment', () => {
    expect(detectIntentionalComment('// fetch the user by id', locator)).toBeNull();
  });
});
