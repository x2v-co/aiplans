import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { publicModelDescription, publicModelName } from './public-catalog-copy';
import { formatModelName } from './model-names';
import { buildMetadata, jsonLd } from './seo';

const markers = /legacy[ -](?:catalog[ -])?slug|deprecated[ -]slug|\bTODO\b|\bFIXME\b|占位|内部备注|\binternal\s+(?:note|review|only)\b/i;

test('persisted legacy name is corrected in labels, metadata, JSON-LD and OG inputs', () => {
  const name = 'DeepSeek V4 Flash (legacy slug; API DeepSeek-V4.1-Flash-1017)';
  assert.equal(publicModelName(name), 'DeepSeek V4.1 Flash (1017)');
  const label = formatModelName(name);
  const metadata = buildMetadata({ locale: 'zh', path: '/models/deepseek-v4-flash',
    title: { en: label, zh: label }, description: { en: label, zh: label } });
  assert.doesNotMatch(JSON.stringify(metadata), markers);
  assert.doesNotMatch(jsonLd({ name: label }), markers);
  assert.equal(publicModelName('GPT-4.1 (batch)'), 'GPT-4.1 (batch)');
});

test('description instructions are removed as whole lines; useful product prose survives', () => {
  assert.equal(publicModelDescription('TODO: write this\nUseful retrieval model.\nFIXME: source missing\n占位内容'), 'Useful retrieval model.');
  assert.equal(publicModelDescription('Legacy catalog slug deepseek-v4-flash. Prefer another row.'), '');
  assert.equal(publicModelDescription('Automation for internal workflows.'), 'Automation for internal workflows.');
});

test('all translation VALUES and public source string literals are free of editorial task markers', () => {
  // AST ignores comments, identifiers, paths and HTML placeholder attributes.
  // Infrastructure errors and legitimate "internal workflows" are not notes.
  for (const locale of ['en', 'zh']) {
    const visit = (value: unknown): void => {
      if (typeof value === 'string') assert.doesNotMatch(value, markers, `messages/${locale}.json`);
      else if (value && typeof value === 'object') Object.values(value).forEach(visit);
    };
    visit(JSON.parse(readFileSync(`messages/${locale}.json`, 'utf8')));
  }
  const sourceFiles = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? sourceFiles(path)
      : /\.tsx?$/.test(path) && !/\.test\./.test(path) ? [path] : [];
  });
  for (const file of [...sourceFiles('src'), 'scripts/data/deepseek-flash-1017-display-2026-10-18.ts']) {
    const ast = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const visit = (node: ts.Node): void => {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
      if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node) || ts.isJsxText(node)) {
        assert.doesNotMatch(node.text, markers, `${file}:${ast.getLineAndCharacterOfPosition(node.pos).line + 1}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(ast);
  }
});
