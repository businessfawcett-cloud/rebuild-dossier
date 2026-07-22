import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { createServer } from '../../../src/server.js';
import { saveCases, loadCases } from '../../../src/state/caseStore.js';
import type { Case } from '../../../src/reconciliation/types.js';

function openCase(id: string): Case {
  return { id, topicKey: id, signals: [], matchedKnownBugs: [], status: 'open' };
}

async function connect(capabilities: Record<string, unknown> = {}) {
  const server = createServer();
  const client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return client;
}

describe('get_case_queue tool', () => {
  it('lists open cases without touching them when interactive is false', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-queue-'));
    try {
      saveCases(dir, [openCase('case:1'), openCase('case:2')]);
      const client = await connect();

      const result = await client.callTool({ name: 'get_case_queue', arguments: { repoPath: dir, interactive: false } });
      const text = (result.content as Array<{ text: string }>)[0]?.text ?? '';

      expect(text).toContain('case:1');
      expect(text).toContain('case:2');
      expect(loadCases(dir).every((c) => c.status === 'open')).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('walks open cases via elicitation and resolves them on accept', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-queue-'));
    try {
      saveCases(dir, [openCase('case:1')]);
      const client = await connect({ elicitation: {} });

      client.setRequestHandler('elicitation/create', async () => ({
        action: 'accept' as const,
        content: { decision: 'intentional', note: 'confirmed via elicitation' }
      }));

      const result = await client.callTool({ name: 'get_case_queue', arguments: { repoPath: dir, interactive: true } });
      const text = (result.content as Array<{ text: string }>)[0]?.text ?? '';

      expect(text).toContain('"open": 0');
      const cases = loadCases(dir);
      expect(cases[0]?.status).toBe('resolved_by_human');
      expect(cases[0]?.humanDecision?.via).toBe('elicitation');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('leaves a case open when the user declines during elicitation', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-queue-'));
    try {
      saveCases(dir, [openCase('case:1')]);
      const client = await connect({ elicitation: {} });

      client.setRequestHandler('elicitation/create', async () => ({ action: 'decline' as const }));

      await client.callTool({ name: 'get_case_queue', arguments: { repoPath: dir, interactive: true } });

      expect(loadCases(dir)[0]?.status).toBe('open');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
