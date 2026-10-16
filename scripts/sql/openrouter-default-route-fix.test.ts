import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('./2026-10-15-openrouter-default-route-fix.sql', import.meta.url), 'utf8');
const scraper = readFileSync(new URL('../scrapers/openrouter.ts', import.meta.url), 'utf8');
const marker = 'OpenRouter model-level default route price from /api/v1/models';

test('默认路由修复 SQL 不再无条件把 cached_input 置空', () => {
  assert.doesNotMatch(sql, /cached_input_price_per_1m\s*=\s*NULL\s*,/);
  assert.doesNotMatch(sql, /cached_input_price_per_1m IS NOT NULL/);
  assert.equal((sql.match(/CASE WHEN (cp|v)\.cached_input_price_per_1m > a\.input_price THEN NULL/g) ?? []).length, 2);
});

test('scraper 审计后已按默认路由重新定价的行被跳过，SQL 重跑为空操作', () => {
  assert.match(sql, /CREATE TEMP TABLE scraper_maintained/);
  assert.match(sql, /cp\.id NOT IN \(SELECT id FROM scraper_maintained\)/);
  assert.match(sql, /cp\.id IN \(SELECT id FROM scraper_maintained\)/);
  // SQL 依赖 scraper 写入的 notes 识别默认路由行，两边必须一致。
  assert.ok(sql.includes(`'%${marker}%'`));
  assert.ok(scraper.includes(`${marker}.`));
});

test('默认仍是 dry-run（ROLLBACK）', () => {
  assert.match(sql, /^ROLLBACK;$/m);
  assert.match(sql, /^-- COMMIT;$/m);
});
