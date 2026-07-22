import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractBuildConfig } from '../../../src/ingest/buildConfig.js';

describe('extractBuildConfig', () => {
  it('extracts literal fields from a vite.config.ts wrapped in defineConfig(), flagging non-literal fields as unresolved', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-viteconfig-'));
    try {
      writeFileSync(
        join(dir, 'vite.config.ts'),
        [
          "import { defineConfig } from 'vite';",
          "import react from '@vitejs/plugin-react';",
          'export default defineConfig({',
          '  plugins: [react()],',
          '  server: { port: 3000, strictPort: true }',
          '});'
        ].join('\n')
      );

      const entries = extractBuildConfig(dir);
      const vite = entries.find((e) => e.tool === 'vite');

      expect(vite).toBeDefined();
      expect(vite?.configFile).toBe('vite.config.ts');
      expect(vite?.fields.server).toEqual({ port: 3000, strictPort: true });
      expect(vite?.unresolved).toContain('plugins');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('extracts literal fields from a CommonJS tailwind.config.js', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-tailwindconfig-'));
    try {
      writeFileSync(
        join(dir, 'tailwind.config.js'),
        [
          'module.exports = {',
          "  content: ['./src/**/*.tsx'],",
          '  theme: { extend: {} }',
          '};'
        ].join('\n')
      );

      const entries = extractBuildConfig(dir);
      const tailwind = entries.find((e) => e.tool === 'tailwind');

      expect(tailwind).toBeDefined();
      expect(tailwind?.fields.content).toEqual(['./src/**/*.tsx']);
      expect(tailwind?.fields.theme).toEqual({ extend: {} });
      expect(tailwind?.unresolved).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('resolves a config declared as a local typed const and exported by reference (a common real-world TS pattern)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-nextconfig-'));
    try {
      writeFileSync(
        join(dir, 'next.config.ts'),
        [
          'import type { NextConfig } from "next";',
          '',
          'const nextConfig: NextConfig = {',
          '  reactStrictMode: true',
          '};',
          '',
          'export default nextConfig;'
        ].join('\n')
      );

      const entries = extractBuildConfig(dir);
      const next = entries.find((e) => e.tool === 'next');

      expect(next?.fields.reactStrictMode).toBe(true);
      expect(next?.unresolved).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns an empty array when no known config files are present', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rebuild-dossier-noconfig-'));
    try {
      expect(extractBuildConfig(dir)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
