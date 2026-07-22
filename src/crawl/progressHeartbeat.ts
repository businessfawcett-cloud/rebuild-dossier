import type { ServerContext } from '@modelcontextprotocol/server';
import type { CrawlProgressInfo } from './crawler.js';

// Progress notifications only fire if the client supplied a progressToken.
// Whether Claude Code actually attaches one to tool calls is unverified —
// the logging heartbeat below is a best-effort fallback regardless, since a
// silent multi-minute call risks being killed as unresponsive.
export function createProgressReporter(ctx: ServerContext): (info: CrawlProgressInfo) => void {
  return (info: CrawlProgressInfo) => {
    const progressToken = ctx.mcpReq._meta?.progressToken;
    if (progressToken !== undefined) {
      void ctx.mcpReq
        .notify({
          method: 'notifications/progress',
          params: { progressToken, progress: info.visited, total: info.total, message: `Crawled ${info.url}` }
        })
        .catch(() => {});
    }
    try {
      void ctx.mcpReq.log?.('info', `Crawled ${info.visited}/${info.total}: ${info.url}`)?.catch?.(() => {});
    } catch {
      // logging capability may not be honored by every client — best effort only
    }
  };
}
