import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyOpenRouterPricing, generateOpenRouterSlug } from './openrouter';
import { parseMistralPriceCell } from './mistral-dynamic';

test('OpenRouter slug generation uses canonical Argon base and batch identities', () => {
  assert.equal(generateOpenRouterSlug('google/gemini-4-argon'), 'gemini-4-argon');
  assert.equal(generateOpenRouterSlug('google/gemini-4-argon:batch'), 'gemini-4-argon-batch');
  assert.equal(generateOpenRouterSlug('google-ai/gemini-4-argon'), 'gemini-4-argon');
  assert.equal(generateOpenRouterSlug('google-gemini-gemini-4-argon-batch'), 'gemini-4-argon-batch');
  assert.equal(generateOpenRouterSlug('openai/gpt-oss-120b'), 'openai-gpt-oss-120b');
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

import { pickOpenRouterFloor, applyOpenRouterFloor, OPENROUTER_FLOOR_HEADLINE_IDS } from './openrouter';
import { OPENROUTER_FLOOR_PRICES } from '../data/verified-2026-10-chatgpt-pro-openrouter';

const ep = (provider_name: string, prompt: string, completion: string, extra: Record<string, unknown> = {}) =>
  ({ provider_name, pricing: { prompt, completion, ...(extra.cache ? { input_cache_read: extra.cache as string } : {}) }, status: extra.status as number | undefined });

test('OpenRouter floor: cheapest available host by input then output, own cache price', () => {
  // gpt-oss-120b endpoints as verified 2026-10-13 (#90).
  const floor = pickOpenRouterFloor([
    ep('DefaultRoute', '0.00000015', '0.0000006', { cache: '0.000000075' }),
    ep('CoreWeave', '0.00000003', '0.00000017'),
    ep('Venice', '0.00000003', '0.00000015', { cache: '0.00000003' }),
    ep('DekaLLM', '0.00000003', '0.00000018'),
    ep('Down', '0.00000001', '0.00000002', { status: -1 }),
    ep('Free', '0', '0'),
  ]);
  assert.ok(floor);
  assert.equal(floor!.provider, 'Venice');
  assert.ok(Math.abs(floor!.input - 0.03) < 1e-9);
  assert.ok(Math.abs(floor!.output - 0.15) < 1e-9);
  assert.ok(Math.abs((floor!.cache ?? -1) - 0.03) < 1e-9);
});

test('OpenRouter floor: no cache price -> null; cache above input -> null; none usable -> null', () => {
  assert.equal(pickOpenRouterFloor([ep('A', '0.00000002', '0.0000005')])!.cache, null);
  assert.equal(pickOpenRouterFloor([ep('A', '0.00000002', '0.0000005', { cache: '0.00000009' })])!.cache, null);
  assert.equal(pickOpenRouterFloor([ep('Free', '0', '0'), ep('Down', '0.000001', '0.000002', { status: 1 })]), null);
});

test('OpenRouter floor: headline is rewritten to the floor (rounded), not the /models default price', () => {
  const headline = { modelName: 'gpt-oss-120b', modelSlug: 'openai-gpt-oss-120b', inputPricePer1M: 0.15, outputPricePer1M: 0.6, cachedInputPricePer1M: 0.075 as number | null, isAvailable: true };
  applyOpenRouterFloor(headline, 'openai/gpt-oss-120b', { provider: 'Venice', input: 0.03 + 1e-12, output: 0.15, cache: null });
  assert.equal(headline.inputPricePer1M, 0.03);
  assert.equal(headline.outputPricePer1M, 0.15);
  assert.equal(headline.cachedInputPricePer1M, null);
});

test('OpenRouter floor: every verified #90 floor model is floor-headlined by the scraper', () => {
  for (const f of OPENROUTER_FLOOR_PRICES) assert.ok(OPENROUTER_FLOOR_HEADLINE_IDS.has(f.openRouterId), f.openRouterId);
  assert.equal(OPENROUTER_FLOOR_HEADLINE_IDS.has('anthropic/claude-sonnet-4'), false);
});
