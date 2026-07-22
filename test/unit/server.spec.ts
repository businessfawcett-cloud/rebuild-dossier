import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/client';
import { createServer } from '../../src/server.js';

async function connectedClient() {
  const server = createServer();
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return { server, client };
}

describe('rebuild-dossier server', () => {
  it('lists all six v0 tools', async () => {
    const { client } = await connectedClient();
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        'crawl_site',
        'flag_known_bug',
        'generate_spec',
        'get_case_queue',
        'ingest_repo',
        'resolve_case'
      ].sort()
    );
  });
});
