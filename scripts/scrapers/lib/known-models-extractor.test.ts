import assert from 'node:assert/strict';
import test from 'node:test';
import { KnownModelsExtractor, type KnownModel } from './known-models-extractor';

class FakeQwen extends KnownModelsExtractor {
  getSourceName() { return 'Qwen'; }
  getSourceUrl() { return 'https://example.test/pricing'; }
  extractMode() { return 'positional' as const; }
  currency() { return 'CNY'; }
  numberRegex() { return /[¥￥]?(\d+\.?\d*)\s*元/g; }
  modelHeaderRegex() { return /qwen[0-9.\-]/i; }
  models(): KnownModel[] {
    return [
      { pattern: /qwen3\.5-plus/i, name: 'qwen3.5-plus', minInput: 0.75, maxInput: 0.85, minOutput: 4.6, maxOutput: 5.0 },
      { pattern: /qwen-flash/i, name: 'qwen-flash', minInput: 0.14, maxInput: 0.16, minOutput: 1.4, maxOutput: 1.6 },
    ];
  }
}

test('a known model that no longer matches is a warning, so full-catalog retirement is skipped', () => {
  const scraper = new FakeQwen();
  const ok = scraper.collectPrices(['qwen3.5-plus', '0.8元', '4.8元', 'qwen-flash', '0.15元', '1.5元']);
  assert.deepEqual(ok.prices.map(price => price.modelName).sort(), ['qwen-flash', 'qwen3.5-plus']);
  assert.deepEqual(ok.warnings, []);

  // Page number moved outside the window: qwen-flash is not extracted and must be reported.
  const moved = scraper.collectPrices(['qwen3.5-plus', '0.8元', '4.8元', 'qwen-flash', '0.2元', '2元']);
  assert.deepEqual(moved.prices.map(price => price.modelName), ['qwen3.5-plus']);
  assert.equal(moved.warnings.length, 1);
  assert.match(moved.warnings[0], /^qwen-flash: known model not matched/);

  // Header gone entirely: same warning.
  const gone = scraper.collectPrices(['qwen3.5-plus', '0.8元', '4.8元']);
  assert.match(gone.warnings.join('\n'), /qwen-flash: known model not matched/);
});

test('index-dynamic only retires unseen channels on a run with zero warnings', async () => {
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(new URL('../../index-dynamic.ts', import.meta.url), 'utf8');
  assert.match(source, /fullCatalog && errorCount === 0 && warningCount === 0 && seenModelIds\.size > 0\)[\s\S]{0,80}retireUnseenChannelPrices/);
  const extractor = readFileSync(new URL('./known-models-extractor.ts', import.meta.url), 'utf8');
  assert.match(extractor, /warnings: warnings\.length > 0 \? warnings : undefined/);
});
