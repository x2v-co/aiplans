import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OPENROUTER_ADDITIONS, auditedPrices, auditedModelSlug, cleanLegacyFeatures } from './catalog-audit-2026-10-15';
import { catalogForKind } from '../../src/lib/ai-vertical-catalog';
import { DecisionModelCatalog, AuditedPricingFacts } from '../../src/components/audited-catalog';
import { canonicalAnthropicPlanName } from '../scrapers/plan-anthropic-dynamic';
import { normalizeModelName } from '../utils/model-normalizer';

test('audit contains all 37 additions, exact conversion and null router sentinels', () => {
  assert.equal(OPENROUTER_ADDITIONS.length, 37);
  assert.equal(new Set(OPENROUTER_ADDITIONS.map(([id]) => id)).size, 37);
  assert.equal(new Set(OPENROUTER_ADDITIONS.map(([id]) => auditedModelSlug(id))).size, 37);
  assert.deepEqual(auditedPrices('0.00000068', '0.00000209'), {
    input_price_per_1m: 0.68, output_price_per_1m: 2.09, notes: 'OpenRouter per-token USD converted to per-1M; audit 2026-10-15.',
  });
  assert.equal(auditedPrices('0.000000435', '0.00000087').input_price_per_1m, 0.435);
  assert.equal(auditedPrices('0.000000044', '0.000000177').output_price_per_1m, 0.177);
  assert.equal(auditedPrices('0.00000004', '0').output_price_per_1m, 0);
  for (const id of ['typesafe/jev-router', 'nvidia/switchyard']) {
    const [, input, output] = OPENROUTER_ADDITIONS.find(([candidate]) => candidate === id)!;
    const row = auditedPrices(input, output);
    assert.equal(row.input_price_per_1m, null);
    assert.equal(row.output_price_per_1m, null);
    assert.match(row.notes, /needs-verification/);
  }
});

test('Mistral 4 and Gemini batch retain independent identities in seeds and normalization', () => {
  assert.equal(auditedModelSlug('mistralai/mistral-large-4-0'), 'mistral-large-4');
  assert.equal(auditedModelSlug('mistralai/mistral-large'), 'mistral-large');
  for (const name of ['Mistral Large 4', 'mistral-large-4-0']) assert.equal(normalizeModelName(name), 'mistral-large-4');
  assert.equal(auditedModelSlug('google/gemini-3.8-flash:batch'), 'google-gemini-gemini-3-8-flash-batch');
});

test('legacy feature cleanup and Max canonicalization do not affect new Pro or unrelated plans', () => {
  assert.deepEqual(cleanLegacyFeatures(['20x Codex', '5x usage', 'China access', 'Keep feature']), ['Keep feature']);
  assert.equal(canonicalAnthropicPlanName('Claude Max', 100), 'Claude Max (5x)');
  assert.equal(canonicalAnthropicPlanName('Claude Max', 200), 'Claude Max (20x)');
  assert.equal(canonicalAnthropicPlanName('Claude Pro', 20), 'Claude Pro');
});

test('only audited video/music values are numeric; range and approximation are explicit', () => {
  const known = new Map([['veo-3-1', [0.4, undefined]], ['veo-3-1-fast', [0.1, 0.3]], ['veo-3-1-lite', [0.05, 0.08]], ['gemini-omni-flash', [0.1, undefined]], ['lyria-3-5', [0.08, undefined]]]);
  for (const item of [...catalogForKind('video-model'), ...catalogForKind('music-model')]) {
    if (known.has(item.slug!)) {
      assert.deepEqual([item.pricePerUnit, item.pricePerUnitHigh], known.get(item.slug!));
      assert.equal(item.verifiedAt, '2026-10-15');
      assert.equal(item.sourceUrls?.[0].url, 'https://ai.google.dev/gemini-api/docs/pricing');
    } else {
      assert.equal(item.pricePerUnit, null, item.slug);
      assert.equal(item.priceStatus, 'needs-verification');
    }
  }
  assert.equal(catalogForKind('video-model').find(i => i.slug === 'sora')?.status, 'discontinued');
  const omni = catalogForKind('video-model').find(i => i.slug === 'gemini-omni-flash')!;
  assert.equal(omni.approximatePrice, true);
  assert.match(renderToStaticMarkup(createElement(AuditedPricingFacts, { item: omni, locale: 'en' })), /≈\$0.10/);
  const fast = catalogForKind('video-model').find(i => i.slug === 'veo-3-1-fast')!;
  assert.match(renderToStaticMarkup(createElement(AuditedPricingFacts, { item: fast, locale: 'zh' })), /\$0.10–\$0.30/);
});

test('decision models distinguish free output from unknown task prices in en/zh', () => {
  const items = catalogForKind('decision-model');
  assert.equal(items.length, 7);
  assert.ok(!items.some(item => item.slug === 'decision-1'));
  for (const item of items) assert.equal(item.pricePer1MTasks, null);
  const snap = items.find(i => i.slug === 'subq-snap')!;
  assert.equal(snap.inputPricePer1M, 0.05);
  assert.equal(snap.outputPricePer1M, 0);
  assert.equal(snap.contextWindowLabel, '384K');
  assert.equal(snap.status, 'preview');
  for (const locale of ['en', 'zh']) {
    const html = renderToStaticMarkup(createElement(DecisionModelCatalog, { items, locale }));
    for (const item of items) assert.ok(html.includes(`/decision-models/${item.slug}`));
    assert.match(html, /\$0.04/);
    assert.match(html, /\$0.05/);
    assert.match(html, /384K/);
    assert.match(html, /—/);
    assert.equal(items.find(i => i.slug === 'scaledown-classify-1')!.inputPricePer1M, 0.04);
    for (const slug of ['typesafe-jev-router']) {
      const unknown = items.find(i => i.slug === slug)!;
      const detail = renderToStaticMarkup(createElement(AuditedPricingFacts, { item: unknown, locale }));
      assert.doesNotMatch(detail, /\$0(?:\.00)?/);
    }
  }
});

test('every replayed category constraint accepts decision rows and preserves the old categories', () => {
  const runner = readFileSync(new URL('../migrate-data-accuracy.ts', import.meta.url), 'utf8');
  const migration = readFileSync(new URL('../../drizzle/0007_catalog_audit_p1.sql', import.meta.url), 'utf8');
  const constraints = [...runner.matchAll(/CHECK \(model_category IN \(([^)]+)\)\)/g), ...migration.matchAll(/model_category IN \(([^)]+)\)/g)];
  assert.ok(constraints.length >= 2);
  for (const match of constraints) {
    for (const category of ['text', 'image', 'video', 'audio', 'music', 'world', 'embedding', 'speech', 'agent', 'decision']) {
      assert.ok(match[1].includes(`'${category}'`), `Replay would reject existing ${category} rows`);
    }
  }
  assert.match(runner, /drizzle\/0007_catalog_audit_p1.sql/);
  const registrations = [...runner.matchAll(/name: '(\d+_[^']+)'/g)].map(match => match[1]);
  const p0 = registrations.indexOf('031_add_model_deprecated_at');
  const p1 = registrations.indexOf('032_catalog_audit_p1');
  assert.ok(p0 >= 0 && p1 > p0);
  assert.ok(registrations[p1] > registrations[p0]);
});

test('audited entries have factual modalities and the static audit passes without DB pricing', () => {
  for (const slug of ['veo-3-1', 'veo-3-1-fast', 'veo-3-1-lite', 'gemini-omni-flash']) {
    const item = catalogForKind('video-model').find(item => item.slug === slug)!;
    assert.deepEqual(item.inputModalities, ['text', 'image'], slug);
    assert.deepEqual(item.outputModalities, ['video'], slug);
  }
  const lyria = catalogForKind('music-model').find(item => item.slug === 'lyria-3-5')!;
  assert.deepEqual(lyria.inputModalities, ['text']);
  assert.deepEqual(lyria.outputModalities, ['audio']);
  for (const item of catalogForKind('decision-model')) {
    assert.deepEqual(item.inputModalities, ['text'], item.slug);
    assert.deepEqual(item.outputModalities, ['text'], item.slug);
  }
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/audit-vertical-catalog.ts'], {
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
    env: { ...process.env, DATABASE_URL: 'invalid-static-audit-must-not-use-db' },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /vertical-catalog audit passed/);
  assert.doesNotMatch(result.stdout, /CRITICAL|WARNING/);
});

test('static audit still warns when verified prices lack numeric values or verification metadata', () => {
  const invalid = [
    ['veo-3-1', { pricePerUnit: null }],
    ['veo-3-1-fast', { verifiedAt: undefined }],
    ['veo-3-1-lite', { pricePerUnit: -1 }],
    ['gemini-omni-flash', { priceStatus: 'needs-verification' }],
    ['lyria-3-5', { pricePerUnit: Number.NaN }],
    ['scaledown-extract', { outputPricePer1M: null }],
    ['scaledown-summarize', { inputPricePer1M: null }],
    ['subq-snap', { currency: undefined }],
  ] as const;
  // Preserve NaN and undefined in the child-process fixtures.
  const setup = invalid.map(([slug, changes]) => {
    const fields = Object.entries(changes).map(([key, value]) =>
      `${key}: ${typeof value === 'number' && Number.isNaN(value) ? 'NaN' : JSON.stringify(value)}`);
    return `Object.assign(AI_VERTICAL_CATALOG.find(item => item.slug === ${JSON.stringify(slug)}), { ${fields.join(', ')} });`;
  }).join('\n');
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--eval', `
    const { AI_VERTICAL_CATALOG } = require('./src/lib/ai-vertical-catalog.ts');
    ${setup}
    require('./scripts/audit-vertical-catalog.ts');
  `], {
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
    env: { ...process.env, DATABASE_URL: 'invalid-static-audit-must-not-use-db' },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  for (const [slug] of invalid) assert.ok(result.stdout.includes(`:${slug}: pricingConfidence=verified`), result.stdout);
  assert.match(result.stdout, /0 critical, 8 warnings/);
});
