import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Node, Project, SyntaxKind, type Expression, type ObjectLiteralExpression, type SourceFile } from 'ts-morph';
import type { BuildConfigEntry, BuildConfigKind } from './evidenceSchema.js';

const KNOWN_CONFIGS: Array<{ fileName: string; tool: BuildConfigKind }> = [
  { fileName: 'vite.config.ts', tool: 'vite' },
  { fileName: 'vite.config.js', tool: 'vite' },
  { fileName: 'tailwind.config.ts', tool: 'tailwind' },
  { fileName: 'tailwind.config.js', tool: 'tailwind' },
  { fileName: 'tailwind.config.cjs', tool: 'tailwind' },
  { fileName: 'next.config.ts', tool: 'next' },
  { fileName: 'next.config.js', tool: 'next' },
  { fileName: 'next.config.mjs', tool: 'next' }
];

// Never executes the target repo's config file — only ever reads its AST.
function findExportedObjectLiteral(sourceFile: SourceFile): ObjectLiteralExpression | null {
  const defaultExport = sourceFile.getExportAssignment(() => true);
  if (defaultExport) {
    return unwrapToObjectLiteral(defaultExport.getExpression(), sourceFile);
  }

  for (const statement of sourceFile.getStatements()) {
    if (!Node.isExpressionStatement(statement)) continue;
    const expr = statement.getExpression();
    if (!Node.isBinaryExpression(expr)) continue;
    const left = expr.getLeft().getText();
    if (left === 'module.exports' || left === 'exports.default') {
      return unwrapToObjectLiteral(expr.getRight(), sourceFile);
    }
  }
  return null;
}

function unwrapToObjectLiteral(expr: Expression, sourceFile: SourceFile): ObjectLiteralExpression | null {
  if (Node.isObjectLiteralExpression(expr)) {
    return expr;
  }
  if (Node.isCallExpression(expr)) {
    const args = expr.getArguments();
    if (args.length === 1 && Node.isObjectLiteralExpression(args[0])) {
      return args[0];
    }
    return null;
  }
  if (Node.isIdentifier(expr)) {
    // A common real-world TS pattern: `const config: Config = {...}; export
    // default config;` — resolve the identifier to its local declaration's
    // initializer instead of giving up on anything that isn't inline.
    const initializer = sourceFile.getVariableDeclaration(expr.getText())?.getInitializer();
    if (initializer) {
      return unwrapToObjectLiteral(initializer, sourceFile);
    }
  }
  return null;
}

function literalToJs(expr: Expression): { ok: true; value: unknown } | { ok: false } {
  if (Node.isStringLiteral(expr) || Node.isNoSubstitutionTemplateLiteral(expr)) {
    return { ok: true, value: expr.getLiteralText() };
  }
  if (Node.isNumericLiteral(expr)) {
    return { ok: true, value: Number(expr.getText()) };
  }
  if (expr.getKind() === SyntaxKind.TrueKeyword) {
    return { ok: true, value: true };
  }
  if (expr.getKind() === SyntaxKind.FalseKeyword) {
    return { ok: true, value: false };
  }
  if (Node.isArrayLiteralExpression(expr)) {
    const values: unknown[] = [];
    for (const element of expr.getElements()) {
      const result = literalToJs(element);
      if (!result.ok) return { ok: false };
      values.push(result.value);
    }
    return { ok: true, value: values };
  }
  if (Node.isObjectLiteralExpression(expr)) {
    const obj = objectLiteralToFields(expr);
    if (obj.unresolved.length > 0) return { ok: false };
    return { ok: true, value: obj.fields };
  }
  return { ok: false };
}

function objectLiteralToFields(objectLiteral: ObjectLiteralExpression): {
  fields: Record<string, unknown>;
  unresolved: string[];
} {
  const fields: Record<string, unknown> = {};
  const unresolved: string[] = [];

  for (const property of objectLiteral.getProperties()) {
    if (!Node.isPropertyAssignment(property)) {
      continue;
    }
    const name = property.getName();
    const initializer = property.getInitializer();
    if (!initializer) {
      unresolved.push(name);
      continue;
    }
    const result = literalToJs(initializer);
    if (result.ok) {
      fields[name] = result.value;
    } else {
      unresolved.push(name);
    }
  }

  return { fields, unresolved };
}

export function extractBuildConfig(repoPath: string): BuildConfigEntry[] {
  const project = new Project({ useInMemoryFileSystem: false });
  const entries: BuildConfigEntry[] = [];

  for (const { fileName, tool } of KNOWN_CONFIGS) {
    const fullPath = join(repoPath, fileName);
    if (!existsSync(fullPath)) continue;

    const sourceFile = project.addSourceFileAtPath(fullPath);
    const objectLiteral = findExportedObjectLiteral(sourceFile);

    if (!objectLiteral) {
      entries.push({ tool, configFile: fileName, fields: {}, unresolved: ['*'] });
      continue;
    }

    const { fields, unresolved } = objectLiteralToFields(objectLiteral);
    entries.push({ tool, configFile: fileName, fields, unresolved });
  }

  return entries;
}
