import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// In this repo `useTranslations` / `useLocale` from 'next-intl' are client
// context hooks. A component that calls them without "use client" throws
// when rendered from a server page (provider/model pages 404/500, #123/#125/#126).
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.tsx') ? [p] : [];
  });
}

test('components using next-intl client hooks are client components', () => {
  const offenders = walk('src/components').filter((file) => {
    const src = readFileSync(file, 'utf8');
    const usesHook = /from ['"]next-intl['"]/.test(src) && /\buse(Translations|Locale)\(/.test(src);
    const isClient = /^\s*(\/\/.*\n|\/\*[\s\S]*?\*\/\s*)*['"]use client['"]/.test(src);
    return usesHook && !isClient;
  });
  assert.deepEqual(offenders, []);
});
