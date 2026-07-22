import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { crawlSite } from '../../../src/crawl/crawler.js';

const here = dirname(fileURLToPath(import.meta.url));
const siteDir = join(here, '../../fixtures/sample-site');

const MIME: Record<string, string> = { '.html': 'text/html' };

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = createServer(async (req, res) => {
    const urlPath = (req.url ?? '/').split('?')[0]!;
    const filePath = join(siteDir, urlPath === '/' ? 'index.html' : urlPath);
    try {
      const content = await readFile(filePath);
      res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] ?? 'text/plain' });
      res.end(content);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
}, 30000);

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('crawlSite', () => {
  it('crawls same-origin reachable pages and records status + console errors', async () => {
    const evidence = await crawlSite(baseUrl, { maxPages: 10 });

    expect(evidence.baseUrl).toBe(baseUrl);

    const visitedPaths = evidence.routesVisited.map((v) => new URL(v.url).pathname).sort();
    expect(visitedPaths).toEqual(['/', '/about.html', '/error.html', '/missing.html']);

    const errorPage = evidence.routesVisited.find((v) => v.url.endsWith('/error.html'));
    expect(errorPage?.consoleErrors.some((e) => e.includes('boom'))).toBe(true);

    const home = evidence.routesVisited.find((v) => new URL(v.url).pathname === '/');
    expect(home?.status).toBe(200);
  }, 30000);

  it('reports the missing page it linked to as a 404 without crawling further from it', async () => {
    const evidence = await crawlSite(baseUrl, { maxPages: 10 });
    const missing = evidence.routesVisited.find((v) => v.url.endsWith('/missing.html'));
    expect(missing?.status).toBe(404);
  }, 30000);

  it('invokes onProgress as pages are crawled', async () => {
    const progressCalls: number[] = [];
    await crawlSite(baseUrl, { maxPages: 10, onProgress: (info) => progressCalls.push(info.visited) });
    expect(progressCalls.length).toBeGreaterThan(0);
    expect(progressCalls).toEqual([...progressCalls].sort((a, b) => a - b));
  }, 30000);

  it('respects maxPages as a hard cap', async () => {
    const evidence = await crawlSite(baseUrl, { maxPages: 1 });
    expect(evidence.routesVisited.length).toBe(1);
  }, 30000);
});
