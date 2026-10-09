import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyOpenRouterPricing } from './openrouter';
import { parseMistralPriceCell } from './mistral-dynamic';

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
