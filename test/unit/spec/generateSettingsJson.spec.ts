import { describe, expect, it } from 'vitest';
import { generateSettingsJson } from '../../../src/spec/generateSettingsJson.js';

describe('generateSettingsJson', () => {
  it('runs the detected test command after every Edit/Write via PostToolUse', () => {
    const settings = generateSettingsJson('npm test');
    const postToolUse = settings.hooks.PostToolUse;

    expect(postToolUse).toHaveLength(1);
    expect(postToolUse[0]?.matcher).toBe('Edit|Write');
    expect(postToolUse[0]?.hooks[0]).toMatchObject({ type: 'command', command: 'npm test' });
  });

  it('blocks edits to spec/ via a PreToolUse hook that exits 2', () => {
    const settings = generateSettingsJson('npm test');
    const preToolUse = settings.hooks.PreToolUse;

    const specHook = preToolUse.find((entry) => entry.hooks[0]?.command.includes("spec[\\\\/]"));
    expect(specHook).toBeDefined();
    expect(specHook?.matcher).toBe('Edit|Write');
    expect(specHook?.hooks[0]?.type).toBe('command');
    expect(specHook?.hooks[0]?.command).toContain('process.exit(2)');
  });

  it('blocks writes to a contract file with no associated test via a second PreToolUse hook', () => {
    const settings = generateSettingsJson('npm test');
    const preToolUse = settings.hooks.PreToolUse;

    const untestedHook = preToolUse.find((entry) => entry.hooks[0]?.command.includes('untested-contracts.json'));
    expect(untestedHook).toBeDefined();
    expect(untestedHook?.matcher).toBe('Edit|Write');
    expect(untestedHook?.hooks[0]?.command).toContain('process.exit(2)');
  });
});
