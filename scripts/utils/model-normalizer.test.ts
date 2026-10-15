import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalizeModelSlug, normalizeModelName, normalizeSlug } from './model-normalizer';

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

test('explicit slug canonicalization preserves unverified IDs and distinct pricing variants', () => {
  for (const value of [
    'google-gemini-gemini-4-argon-free', 'google/gemini-4-argon:flex',
    'google-gemini-gemini-4-argon-20261014', 'google-gemini-gemini-3-flash-preview',
    'openai-gpt-4o', 'openai-gpt-4.1-mini', 'anthropic-claude-sonnet-4.6-batch',
    'vendor-family-family-1', 'gemini-4-argonish',
  ]) assert.equal(canonicalizeModelSlug(value), value);
});
