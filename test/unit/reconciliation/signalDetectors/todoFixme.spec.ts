import { describe, expect, it } from 'vitest';
import { detectTodoFixme } from '../../../../src/reconciliation/signalDetectors/todoFixme.js';

const locator = { file: 'src/foo.ts', startLine: 1, endLine: 1 };

describe('detectTodoFixme', () => {
  it('detects a TODO comment admitting a bug', () => {
    const intent = detectTodoFixme('// TODO: this throws on empty input, fix it', locator);
    expect(intent).not.toBeNull();
    expect(intent?.kind).toBe('todo');
    expect(intent?.confidence).toBeGreaterThan(0.5);
  });

  it('detects a FIXME comment', () => {
    const intent = detectTodoFixme('// FIXME off-by-one here', locator);
    expect(intent?.kind).toBe('fixme');
  });

  it('is case-insensitive', () => {
    expect(detectTodoFixme('// todo: handle null', locator)).not.toBeNull();
    expect(detectTodoFixme('// fixme later', locator)).not.toBeNull();
  });

  it('returns null for a comment with no TODO/FIXME marker', () => {
    expect(detectTodoFixme('// returns the user by id', locator)).toBeNull();
  });

  it('does not match TODO/FIXME appearing mid-word', () => {
    expect(detectTodoFixme('// see the methodology doc', locator)).toBeNull();
  });
});
