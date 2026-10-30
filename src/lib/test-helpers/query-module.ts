import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

type SqlStub = (strings: TemplateStringsArray, ...values: unknown[]) => unknown;
class RawSql {
  constructor(readonly text: string) {}
}

/** Expand shared SQL fragments while leaving bound parameters visible to stubs. */
function withFragments(sql: SqlStub) {
  return Object.assign((strings: TemplateStringsArray, ...values: unknown[]) => {
    const parts = [strings[0]];
    const parameters: unknown[] = [];
    values.forEach((value, i) => {
      if (value instanceof RawSql) parts[parts.length - 1] += value.text + strings[i + 1];
      else {
        parameters.push(value);
        parts.push(strings[i + 1]);
      }
    });
    return sql(Object.assign(parts, { raw: [...parts] }) as TemplateStringsArray, ...parameters);
  }, sql, { unsafe: (text: string) => new RawSql(text) });
}

/** Run real query/route code against read-only dependency stubs, without a DB. */
export function loadQueryModule(url: URL, mocks: Record<string, unknown>): Record<string, unknown> {
  const require = createRequire(url);
  const dependencies = { ...mocks };
  for (const key of ['./db', '@/lib/db']) {
    if (key in dependencies) {
      const db = dependencies[key] as { sql: SqlStub };
      dependencies[key] = { ...db, sql: withFragments(db.sql) };
    }
  }
  const source = readFileSync(url, 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } });
  const loaded = { exports: {} as Record<string, unknown> };
  const execute = runInNewContext(`(function(require, module, exports) { ${outputText}\n})`);
  execute((id: string) => {
    if (id in dependencies) return dependencies[id];
    if (id === './plan-lifecycle-query' || id === '@/lib/plan-lifecycle-query') {
      return loadQueryModule(new URL('../plan-lifecycle-query.ts', import.meta.url), {
        './db': dependencies['./db'] ?? dependencies['@/lib/db'],
      });
    }
    return require(id.startsWith('@/')
      ? fileURLToPath(new URL(`../../${id.slice(2)}`, import.meta.url)) : id);
  }, loaded, loaded.exports);
  return loaded.exports;
}
