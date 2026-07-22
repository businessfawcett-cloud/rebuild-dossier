import type { OAuthTokenVerifier } from '@modelcontextprotocol/express';
import { createMcpExpressApp, requireBearerAuth } from '@modelcontextprotocol/express';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { createMcpHandler, OAuthError, OAuthErrorCode } from '@modelcontextprotocol/server';
import { createServer } from './server.js';
import { timingSafeEqualString } from './security/timingSafeEqualString.js';

const PORT = Number(process.env.PORT ?? 8080);
const HOST = '0.0.0.0';
const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN;
const ALLOWED_HOSTS = (process.env.MCP_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

// Fail fast rather than silently serve an unauthenticated or DNS-rebinding-
// vulnerable endpoint — both are required precisely because this mode is
// meant to be reachable from the public internet, unlike stdio mode.
if (!AUTH_TOKEN) {
  console.error('MCP_AUTH_TOKEN must be set to run rebuild-dossier in HTTP mode.');
  process.exit(1);
}
if (ALLOWED_HOSTS.length === 0) {
  console.error(
    'MCP_ALLOWED_HOSTS must be set (comma-separated hostnames this server is reachable at, e.g. "rebuild-dossier.fly.dev") to run in HTTP mode.'
  );
  process.exit(1);
}
if (!process.env.REBUILD_DOSSIER_ALLOWED_PATHS) {
  console.error(
    'REBUILD_DOSSIER_ALLOWED_PATHS must be set (comma-separated absolute paths this server is allowed to read/write) to run in HTTP mode — running a network-reachable instance with unrestricted filesystem access is not supported.'
  );
  process.exit(1);
}

const verifier: OAuthTokenVerifier = {
  async verifyAccessToken(token) {
    if (!timingSafeEqualString(token, AUTH_TOKEN)) {
      throw new OAuthError(OAuthErrorCode.InvalidToken, 'Invalid token');
    }
    // A static long-lived shared secret, not a real issued token — push
    // expiresAt far out. The SDK rejects any AuthInfo with it unset.
    return {
      token,
      clientId: 'rebuild-dossier-client',
      scopes: ['mcp'],
      expiresAt: Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 3600
    };
  }
};

const auth = requireBearerAuth({ verifier, requiredScopes: ['mcp'] });
const app = createMcpExpressApp({ host: HOST, allowedHosts: ALLOWED_HOSTS });
const mcpNodeHandler = toNodeHandler(createMcpHandler(createServer));

// Unauthenticated on purpose — a platform health check (e.g. Fly.io) needs
// to reach this without a bearer token, and it reveals nothing sensitive.
app.get('/health', (_req, res) => {
  res.status(200).send('ok');
});

app.all('/mcp', auth, (req, res) => {
  void mcpNodeHandler(req, res, req.body);
});

app.listen(PORT, HOST, () => {
  console.error(`rebuild-dossier MCP server listening on http://${HOST}:${PORT}/mcp`);
});
