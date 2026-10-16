import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveHostModelSlug } from './coding-agent-host';

test('keeps an explicit hostModelSlug', () => {
  assert.equal(deriveHostModelSlug({ hostModelSlug: 'anthropic_claude-opus-5' }), 'anthropic_claude-opus-5');
});

test('derives slug from display.model + modelCreators when hostModelSlug is gone (AA 2026-10-16 snapshot)', () => {
  assert.equal(
    deriveHostModelSlug({ display: { model: 'Sonnet 5.5 (max)' }, modelCreators: [{ slug: 'anthropic' }], provider: 'anthropic' }),
    'anthropic_sonnet-5-5',
  );
  assert.equal(
    deriveHostModelSlug({ display: { model: 'DeepSeek V4 Pro 0813 (max)' }, modelCreators: [{ slug: 'deepseek' }] }),
    'deepseek_deepseek-v4-pro-0813',
  );
});

test('falls back to record.provider when modelCreators is missing', () => {
  assert.equal(deriveHostModelSlug({ display: { model: 'Kimi K3' }, provider: 'moonshotai' }), 'moonshotai_kimi-k3');
});

test('returns null when no host info exists, so the record is skipped instead of crashing', () => {
  assert.equal(deriveHostModelSlug({}), null);
  assert.equal(deriveHostModelSlug({ hostModelSlug: undefined, display: null }), null);
  assert.equal(deriveHostModelSlug({ display: { model: '(max)' } }), null);
});
