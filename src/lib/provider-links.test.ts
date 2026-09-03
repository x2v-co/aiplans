import assert from 'node:assert/strict';
import test from 'node:test';
import { getProviderVisitUrl } from './provider-links';

test('prefers the pricing page for API channel visits', () => {
  assert.equal(
    getProviderVisitUrl({
      slug: 'anthropic',
      website: 'https://anthropic.com',
      pricing_url: 'https://claude.com/pricing#api',
    }),
    'https://claude.com/pricing#api',
  );
});

test('prefers an invite URL for plan visits', () => {
  assert.equal(
    getProviderVisitUrl({
      website: 'https://example.com',
      inviteUrl: 'https://example.com/join?ref=abc',
    }, 'plan'),
    'https://example.com/join?ref=abc',
  );
});

test('fills the known OpenRouter data gap and rejects unsafe schemes', () => {
  assert.equal(getProviderVisitUrl({ slug: 'openrouter', website: '' }), 'https://openrouter.ai/models');
  assert.equal(getProviderVisitUrl({ website: 'javascript:alert(1)' }), null);
});
