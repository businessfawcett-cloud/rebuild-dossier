import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expressRouterDetector } from '../../../../src/ingest/routeDetectors/expressRouter.js';

describe('expressRouterDetector', () => {
  it('applies only when express is a dependency', () => {
    expect(expressRouterDetector.applies({ scripts: {}, dependencies: { express: '^4.19.0' }, devDependencies: {} })).toBe(true);
    expect(expressRouterDetector.applies({ scripts: {}, dependencies: {}, devDependencies: {} })).toBe(false);
  });

  it('detects app.get/post/put/delete route registrations with their methods and paths', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-express-'));
    try {
      const file = join(dir, 'server.ts');
      writeFileSync(
        file,
        [
          "app.get('/api/users/:id', (req, res) => {});",
          "app.post('/api/users', (req, res) => {});",
          "router.delete('/api/users/:id', (req, res) => {});"
        ].join('\n')
      );

      const routes = expressRouterDetector.detect(dir, [file]);

      expect(routes).toContainEqual({ path: '/api/users/:id', method: 'GET', file: 'server.ts', kind: 'api', startLine: 1 });
      expect(routes).toContainEqual({ path: '/api/users', method: 'POST', file: 'server.ts', kind: 'api', startLine: 2 });
      expect(routes).toContainEqual({ path: '/api/users/:id', method: 'DELETE', file: 'server.ts', kind: 'api', startLine: 3 });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
