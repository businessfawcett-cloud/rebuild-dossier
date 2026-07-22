import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

// Writes via a temp file + rename so a crash mid-write never leaves a
// corrupt/partial evidence or case-store file behind.
export function atomicWriteFile(filePath: string, content: string): void {
  const dir = dirname(filePath);
  mkdirSync(dir, { recursive: true });
  const tempPath = join(dir, `.tmp-${randomUUID()}`);
  try {
    writeFileSync(tempPath, content);
    renameSync(tempPath, filePath);
  } catch (err) {
    rmSync(tempPath, { force: true });
    throw err;
  }
}
