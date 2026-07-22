import { chromium } from 'playwright';
import type { CrawlEvidence, RouteVisit } from './crawlEvidenceSchema.js';

export interface CrawlProgressInfo {
  visited: number;
  total: number;
  url: string;
}

export interface CrawlOptions {
  maxPages?: number;
  onProgress?: (info: CrawlProgressInfo) => void;
  signal?: AbortSignal;
}

const DEFAULT_MAX_PAGES = 50;

function isSameOrigin(url: string, origin: string): boolean {
  try {
    return new URL(url).origin === origin;
  } catch {
    return false;
  }
}

export async function crawlSite(baseUrl: string, options: CrawlOptions = {}): Promise<CrawlEvidence> {
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  // Normalized once via the URL constructor so the seed URL matches the same
  // string shape the browser produces when resolving <a href> (e.g. an empty
  // path always normalizes to a trailing "/"), otherwise the same page gets
  // queued twice under two different-looking URLs.
  const normalizedBaseUrl = new URL(baseUrl).href;
  const origin = new URL(baseUrl).origin;

  const browser = await chromium.launch({ headless: true });
  const routesVisited: RouteVisit[] = [];

  try {
    const page = await browser.newPage();
    const visited = new Set<string>();
    const queue: string[] = [normalizedBaseUrl];
    let consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    while (queue.length > 0 && routesVisited.length < maxPages) {
      if (options.signal?.aborted) break;

      const url = queue.shift()!;
      if (visited.has(url)) continue;
      visited.add(url);

      consoleErrors = [];
      const response = await page.goto(url, { waitUntil: 'load' });
      const status = response?.status() ?? 0;

      routesVisited.push({ url, status, consoleErrors: [...consoleErrors] });
      options.onProgress?.({ visited: routesVisited.length, total: visited.size + queue.length, url });

      if (status >= 200 && status < 300) {
        const links = await page.$$eval('a[href]', (anchors) => anchors.map((a) => (a as HTMLAnchorElement).href));
        for (const link of links) {
          if (isSameOrigin(link, origin) && !visited.has(link) && !queue.includes(link)) {
            queue.push(link);
          }
        }
      }
    }
  } finally {
    await browser.close();
  }

  return {
    baseUrl,
    generatedAt: new Date().toISOString(),
    routesVisited,
    signals: []
  };
}
