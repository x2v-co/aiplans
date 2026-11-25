import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalizeModelSlug, normalizeModelName, normalizeSlug, sanitizeModelSlug } from './model-normalizer';

test('thinking and free qualifiers survive ingestion separately from the base SKU', () => {
  for (const [input, expected] of [
    ['claude-3.7-sonnet-(thinking)', 'claude-3.7-sonnet-thinking'],
    ['Claude Opus 5 (Thinking)', 'claude-opus-5-thinking'],
    ['gpt-4o (free)', 'gpt-4o-free'],
    ['gemini-2.0-flash (free)', 'gemini-2.0-flash-free'],
  ]) {
    assert.equal(normalizeSlug(input), expected, input);
    assert.equal(normalizeSlug(expected), expected, 'normalization is idempotent');
    assert.notEqual(normalizeSlug(input), normalizeSlug(input.replace(/[- ]*\((?:thinking|free)\)$/i, '')));
  }
  for (const qualifier of ['thinking', 'free', 'batch']) {
    const expected = `claude-opus-5-${qualifier}`;
    assert.equal(sanitizeModelSlug(`Claude Opus 5 (${qualifier})`), expected);
    assert.equal(canonicalizeModelSlug(`claude-opus-5-(${qualifier})`), expected);
    assert.equal(normalizeSlug(`claude-opus-5:${qualifier}`), expected);
    assert.equal(normalizeSlug(expected), expected);
  }
  assert.equal(sanitizeModelSlug('Gemini 4 Argon (starting December 1, 2026), Gemini 4 Argon Batch'), 'gemini-4-argon');
});

test('free and thinking preserve the complete preview, instruct, dated and namespace identity', () => {
  for (const qualifier of ['free', 'thinking']) {
    for (const base of ['gemini-3-flash-preview', 'google-gemini-gemini-3-flash-preview',
      'qwen3-next-80b-a3b-instruct', 'claude-opus-5-preview', 'gpt-4o-2024-08-06']) {
      const expected = `${base}-${qualifier}`;
      for (const input of [expected, `${base}:${qualifier}`, `${base} (${qualifier})`]) {
        assert.equal(normalizeSlug(input), expected, input);
        assert.equal(normalizeSlug(expected), expected, 'idempotent');
      }
    }
    assert.equal(normalizeSlug(`google/gemini-3-flash-preview:${qualifier}`), `google-gemini-3-flash-preview-${qualifier}`);
    assert.notEqual(normalizeSlug(`gemini-3-flash-preview-${qualifier}`), normalizeSlug(`gemini-3-flash-${qualifier}`));
    assert.notEqual(normalizeSlug(`qwen3-next-80b-a3b-instruct-${qualifier}`), normalizeSlug(`qwen3-next-80b-a3b-${qualifier}`));
  }
});

test('Argon names, provider IDs and legacy explicit slugs resolve to canonical products', () => {
  const baseInputs = [
    'gemini-4-argon', 'Gemini 4 Argon', 'Google: Gemini 4 Argon',
    'google/gemini-4-argon', 'google-ai/gemini-4-argon',
    'google-gemini/gemini-4-argon', 'google-gemini-4-argon',
    'google-gemini-gemini-4-argon',
  ];
  for (const input of baseInputs) {
    for (const [suffix, expected] of [
      ['', 'gemini-4-argon'], [':batch', 'gemini-4-argon-batch'],
      ['-batch', 'gemini-4-argon-batch'], [' (batch)', 'gemini-4-argon-batch'],
    ]) {
      const value = input + suffix;
      assert.equal(canonicalizeModelSlug(value), expected, value);
      assert.equal(normalizeSlug(value), expected, value);
      assert.equal(normalizeModelName(value), expected, value);
      assert.equal(canonicalizeModelSlug(expected), expected);
    }
  }
});

test('Carbon standard and batch ids join the official row; flex and dated ids do not', () => {
  for (const input of ['gemini-4-carbon', 'google/gemini-4-carbon', 'google-gemini-gemini-4-carbon']) {
    assert.equal(canonicalizeModelSlug(input), 'gemini-4-carbon', input);
    assert.equal(canonicalizeModelSlug(`${input}:batch`), 'gemini-4-carbon-batch', input);
  }
  for (const value of ['google/gemini-4-carbon:flex', 'google-gemini-gemini-4-carbon-free', 'gemini-4-carbon-20261110']) {
    assert.equal(canonicalizeModelSlug(value), value);
  }
});

test('explicit slug canonicalization preserves unverified IDs and distinct pricing variants', () => {
  for (const value of [
    'google-gemini-gemini-4-argon-free', 'google/gemini-4-argon:flex',
    'google-gemini-gemini-4-argon-20261014', 'google-gemini-gemini-3-flash-preview',
    'openai-gpt-4o', 'openai-gpt-4.1-mini', 'anthropic-claude-sonnet-4.6-batch',
    'vendor-family-family-1', 'gemini-4-argonish',
  ]) assert.equal(canonicalizeModelSlug(value), value);
});

test('Kimi K3.1 official pricing joins the published OpenRouter model', () => {
  for (const value of ['kimi-k3.1-pro', 'kimi-k3-1-pro', 'moonshotai/kimi-k3.1-pro', 'moonshotai-kimi-k3-1-pro']) {
    assert.equal(canonicalizeModelSlug(value), 'moonshotai-kimi-k3-1-pro');
    assert.equal(normalizeSlug(value), 'moonshotai-kimi-k3-1-pro');
  }
  for (const value of ['kimi-k3.1-pro-highspeed', 'kimi-k3.1-pro-20261023', 'kimi-k3', 'kimi-k3.1-pro-batch']) {
    assert.equal(canonicalizeModelSlug(value), value);
  }
});

test('MiniMax Flash aliases converge without collapsing previews, batch or Highspeed', () => {
  for (const value of ['minimax-m3.1', 'MiniMax-M3.1-Flash', 'minimax-minimax-m3-1-flash', 'minimax/minimax-m3.1-flash']) {
    assert.equal(canonicalizeModelSlug(value), 'minimax-m3.1-flash', value);
    assert.equal(normalizeSlug(value), 'minimax-m3.1-flash', value);
  }
  for (const value of ['minimax-m3.1-flash-preview', 'minimax-m3.1-highspeed', 'minimax-m3.1-flash-batch', 'minimax-m3']) assert.equal(canonicalizeModelSlug(value), value);
});
