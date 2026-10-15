import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyOpenRouterPricing, generateOpenRouterSlug, scrapeOpenRouter, openRouterProducerSlug } from './openrouter';
import { parseMistralPriceCell } from './mistral-dynamic';

test('OpenRouter slug generation uses canonical Argon base and batch identities', () => {
  assert.equal(generateOpenRouterSlug('google/gemini-4-argon'), 'gemini-4-argon');
  assert.equal(generateOpenRouterSlug('google/gemini-4-argon:batch'), 'gemini-4-argon-batch');
  assert.equal(generateOpenRouterSlug('google-ai/gemini-4-argon'), 'gemini-4-argon');
  assert.equal(generateOpenRouterSlug('google-gemini-gemini-4-argon-batch'), 'gemini-4-argon-batch');
  assert.equal(generateOpenRouterSlug('openai/gpt-oss-120b'), 'gpt-oss-120b');
  assert.equal(generateOpenRouterSlug('google/gemini-4-argon:free'), 'google-gemini-gemini-4-argon-free');
});

test('OpenRouter: router sentinel "-1" is variable pricing, not an error', () => {
  // Live /api/v1/models on 2026-10-09: typesafe/jev-router, nvidia/switchyard.
  assert.equal(classifyOpenRouterPricing({ prompt: '-1', completion: '-1' }).kind, 'variable');
  assert.equal(classifyOpenRouterPricing({ prompt: '-1.0', completion: '0.000002' }).kind, 'variable');
});

test('OpenRouter: normal per-token prices convert to $/1M', () => {
  const r = classifyOpenRouterPricing({ prompt: '0.000003', completion: '0.000015', input_cache_read: '0.0000003' });
  assert.equal(r.kind, 'ok');
  if (r.kind !== 'ok') return;
  assert.ok(Math.abs(r.input - 3) < 1e-9);
  assert.ok(Math.abs(r.output - 15) < 1e-9);
  assert.ok(Math.abs((r.cache ?? 0) - 0.3) < 1e-9);
  assert.equal(classifyOpenRouterPricing({ prompt: '0', completion: '0' }).kind, 'ok');
});

test('OpenRouter: malformed prices are invalid (warning), not silently ok', () => {
  assert.equal(classifyOpenRouterPricing({ prompt: 'n/a', completion: '0.00001' }).kind, 'invalid');
  assert.equal(classifyOpenRouterPricing({ prompt: '', completion: '0.00001' }).kind, 'invalid');
  assert.equal(classifyOpenRouterPricing(undefined).kind, 'invalid');
  assert.equal(classifyOpenRouterPricing({ prompt: '0.01', completion: '0.01' }).kind, 'invalid'); // $10k/1M
});

test('Mistral: sale price wins, non-token units are ignored', () => {
  assert.equal(parseMistralPriceCell('Original price: $1.36 Sale price: $0.68'), 0.68);
  assert.equal(parseMistralPriceCell('$0.3'), 0.3);
  assert.equal(parseMistralPriceCell('$1 /1000 Pages'), null);
  assert.equal(parseMistralPriceCell('Free'), null);
  assert.equal(parseMistralPriceCell(undefined), null);
});

import { pickOpenRouterFloor } from './openrouter';
import { readFileSync } from 'node:fs';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/openrouter-default-routes.json', import.meta.url), 'utf8')) as {
  data: Array<{ id: string; name: string; pricing: { prompt: string; completion: string } }>;
  expected: Array<{ slug: string; id: string; input: number; output: number }>;
  endpoints: Record<string, unknown[]>;
};

test('all nine audit mismatches use model default prices; endpoint floor is separate and names the host', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async input => {
    const url = String(input);
    const id = url.replace('https://openrouter.ai/api/v1/models/', '').replace(/\/endpoints$/, '');
    return new Response(JSON.stringify(url.endsWith('/endpoints')
      ? { data: { endpoints: fixture.endpoints[id] ?? [] } } : { data: fixture.data }));
  };
  try {
    const result = await scrapeOpenRouter();
    assert.equal(result.success, true);
    assert.equal(result.prices.length, 9);
    for (const expected of fixture.expected) {
      const headline = result.prices.find(row => row.modelSlug === expected.slug)!;
      assert.ok(headline, expected.slug);
      assert.equal(headline.cachedInputPricePer1M, null);
      assert.ok(Math.abs(headline.inputPricePer1M - expected.input) < 1e-9);
      assert.ok(Math.abs(headline.outputPricePer1M - expected.output) < 1e-9);
      const route = result.variants!.find(row => row.modelSlug === expected.slug && row.isHeadline)!;
      assert.equal(route.variantKind, 'default_route');
      assert.equal(route.inputPricePer1M, headline.inputPricePer1M);
      assert.equal(route.outputPricePer1M, headline.outputPricePer1M);
      assert.match(route.headlineReason!, /model-level default route price from \/api\/v1\/models/);
      assert.equal(route.sourceUrl, 'https://openrouter.ai/api/v1/models');
    }
    const floors = result.variants!.filter(row => row.variantKind === 'cheapest_endpoint');
    assert.deepEqual(floors.map(row => [row.modelSlug, row.sourceGroupName, row.inputPricePer1M, row.outputPricePer1M, row.isHeadline]),
      [['gpt-oss-120b', 'Venice', 0.03, 0.15, false], ['qwen-qwen3-8-27b', 'Tenstorrent', 0.02, 0.5, false]]);
  } finally { globalThis.fetch = originalFetch; }
});

test('endpoint outages still publish verified defaults with warnings, preventing full-catalog retirement', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async input => String(input).endsWith('/endpoints')
    ? new Response('', { status: 503 }) : new Response(JSON.stringify({ data: fixture.data }));
  try {
    const result = await scrapeOpenRouter();
    assert.equal(result.success, true);
    assert.equal(result.warnings?.length, 9);
    assert.equal(result.prices.length, 9);
    assert.equal(result.variants?.length, 9);
    assert.ok(result.variants!.every(row => row.isHeadline));
  } finally { globalThis.fetch = originalFetch; }
});

test('cheapest endpoints reject down, malformed and negative prices; explicit free prices remain valid', () => {
  const ep = (provider_name: string, prompt: string, completion: string, status = 0) => ({ provider_name, pricing: { prompt, completion }, status });
  assert.equal(pickOpenRouterFloor([ep('Down', '0.00000002', '0.0000005', 1), ep('Invalid', '', '1'), ep('Variable', '-1', '-1')]), null);
  assert.deepEqual(pickOpenRouterFloor([ep('Venice', '0.00000003', '0.00000015')]),
    { provider: 'Venice', input: 0.03, output: 0.15, cache: null });
  assert.equal(pickOpenRouterFloor([ep('Free', '0', '0')])?.input, 0);
});

import { OPENROUTER_ADDITIONS } from '../data/catalog-audit-2026-10-15';

test('full OpenRouter feed retains new producer metadata, free output and distinct version/batch IDs', async () => {
  const originalFetch = globalThis.fetch;
  const feed = OPENROUTER_ADDITIONS.map(([id, prompt, completion]) => ({ id, pricing: { prompt, completion } }));
  globalThis.fetch = async url => {
    const endpoints = String(url).endsWith('/endpoints');
    return new Response(JSON.stringify({ data: endpoints ? { endpoints: [] } : feed }), { status: 200 });
  };
  try {
    const result = await scrapeOpenRouter();
    assert.equal(result.success, true);
    assert.equal(result.prices.length, 35); // Two variable routers deliberately have no numeric scraped rate.
    const liquid = result.prices.find(p => p.modelSlug === generateOpenRouterSlug('liquid/lfm-2.5-24b-a2b'))!;
    assert.equal(liquid.producerSlug, 'liquid');
    assert.equal(result.prices.find(p => p.modelSlug === 'scaledown-extract')?.outputPricePer1M, 0);
    assert.ok(result.prices.some(p => p.modelSlug === 'mistral-large-4'));
    assert.ok(result.prices.some(p => p.modelSlug === 'google-gemini-gemini-3-8-flash-batch'));
    assert.equal(openRouterProducerSlug('~unbiased/pareto-latest'), 'unbiased');
    assert.equal(openRouterProducerSlug('google/gemini-3.8-flash:batch'), 'google');
    for (const price of result.prices) assert.ok(price.producerSlug);
  } finally { globalThis.fetch = originalFetch; }
});

import { buildOpenRouterVariants } from './openrouter';

test('DeepSeek window normalization is scoped to StreamLake endpoints and unambiguous defaults', () => {
  const model = { id: 'deepseek/deepseek-v4-pro', name: 'DeepSeek', pricing: { prompt: '0.000001', completion: '0.000002' }, context_length: 1_000_000 };
  const headline = () => ({ modelName: 'deepseek-v4-pro', modelSlug: 'deepseek-v4-pro', inputPricePer1M: 1, outputPricePer1M: 2, isAvailable: true });
  const streamlake = { provider_name: 'StreamLake', pricing: model.pricing };
  const variants = buildOpenRouterVariants(model, headline(), [streamlake], new Date('2026-10-16T02:00Z'));
  assert.equal(variants[0].deepseekWindow, true);
  assert.equal(variants.find(v => v.variantKind === 'upstream_provider')!.deepseekWindow, true);
  assert.equal(variants[0].observedAt, '2026-10-16T02:00:00.000Z');
  assert.equal(variants[0].constraints?.schedule_status, 'needs-verification');
  assert.equal(buildOpenRouterVariants(model, headline(), [streamlake, { ...streamlake, provider_name: 'Other', status: 1 }])[0].deepseekWindow, true);
  for (const endpoints of [[], [{ ...streamlake, provider_name: 'Other' }], [streamlake, { ...streamlake, provider_name: 'Other' }]]) {
    assert.ok(!buildOpenRouterVariants(model, headline(), endpoints)[0].deepseekWindow);
  }
  assert.ok(!buildOpenRouterVariants({ ...model, id: 'other/model' }, headline(), [streamlake])[0].deepseekWindow);
});
