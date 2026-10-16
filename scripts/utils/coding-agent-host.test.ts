import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveHostModelSlug, resolveHostModel } from './coding-agent-host';

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

test('AA 2026-10-16 snapshot: 41/42 hosts resolve against the live catalog slug forms', () => {
  const hosts = ["google_gemini-4-argon", "anthropic_sonnet-5-5", "meta_muse-wonder", "openai_gpt-6-1-sol", "openai_gpt-6-astra", "xai_grok-4-7", "anthropic_fable-5-1", "anthropic_opus-5-5", "google_gemini-3-8-flash", "openai_gpt-6-astra-xhigh-swe-2-medium", "anthropic_haiku-5-5", "meta_muse-spark-open", "alibaba_qwen3-8-max", "anthropic_haiku-5-5", "anthropic_claude-opus-5-5-max-gpt-6-luna-high", "anthropic_claude-fable-5-1-xhigh-swe-2-medium", "openai_gpt-5-6-sol", "openai_gpt-6-1-sol", "meta_muse-wonder-full", "anthropic_haiku-5-5", "reflection_beam-1-0", "anthropic_opus-5", "stepfun_step-5-preview", "anthropic_sonnet-5-5", "anthropic_sonnet-5-5", "openai_gpt-6-sol", "anthropic_haiku-5-5", "openai_gpt-6-luna", "meta_muse-spark-1-3", "anthropic_sonnet-5-5", "meta_muse-spark-1-3", "anthropic_sonnet-5-5", "deepseek_deepseek-v4-flash-0731", "openai_gpt-6-1-sol", "anthropic_haiku-5-5", "openai_gpt-6-1-sol", "kimi_kimi-k3", "zai_glm-5-3", "xai_grok-4-6", "openai_gpt-5-6-luna", "deepseek_deepseek-v4-pro-0813", "openai_gpt-6-1-sol"];
  const local = new Map(["gemini-4-argon", "anthropic-claude-sonnet-5-5", "anthropic-claude-sonnet-5-5-batch", "muse-wonder", "meta-muse-wonder", "openai-gpt-6-1-sol", "openai-gpt-6-1-sol-batch", "openai-gpt-6-1-sol-pro", "openai-gpt-6-astra", "grok-4.7", "anthropic-claude-fable-5-1", "anthropic-claude-opus-5-5", "gemini-3.8-flash", "claude-haiku-5.5", "anthropic-claude-haiku-5-5", "meta-muse-spark-open", "qwen3.8-max", "qwen-qwen3-8-27b", "gpt-5.6-sol", "reflection-beam-1-0-501b-a23b", "anthropic-claude-opus-5", "stepfun-step-5-preview", "openai-gpt-6-sol", "openai-gpt-6-luna", "meta-muse-spark-1-3", "deepseek-v4-flash", "kimi-k3", "glm-5.3", "grok-4.6", "gpt-5.6-luna", "deepseek-v4-pro"].map((slug, id) => [slug, { id }] as const));
  const missing = hosts.filter(h => !resolveHostModel(h, local));
  assert.deepEqual([...new Set(missing)], ['meta_muse-wonder-full']);
  const to = (h: string) => resolveHostModel(h, local)?.slug;
  assert.equal(to('anthropic_sonnet-5-5'), 'anthropic-claude-sonnet-5-5');
  assert.equal(to('anthropic_opus-5-5'), 'anthropic-claude-opus-5-5');
  assert.equal(to('anthropic_haiku-5-5'), 'claude-haiku-5.5');
  assert.equal(to('openai_gpt-6-1-sol'), 'openai-gpt-6-1-sol');
  assert.equal(to('openai_gpt-6-astra'), 'openai-gpt-6-astra');
  assert.equal(to('alibaba_qwen3-8-max'), 'qwen3.8-max', 'max is part of the name, not an effort tag');
  assert.equal(to('reflection_beam-1-0'), 'reflection-beam-1-0-501b-a23b');
  assert.equal(to('anthropic_claude-opus-5-5-max-gpt-6-luna-high'), 'anthropic-claude-opus-5-5', 'fusion host keeps lead model');
  assert.equal(to('deepseek_deepseek-v4-pro-0813'), 'deepseek-v4-pro');
});

test('never maps onto -batch / -pro siblings or ambiguous size variants', () => {
  const local = new Map([['openai-gpt-6-luna-batch', { id: 1 }], ['openai-gpt-6-luna-pro', { id: 2 }], ['x-1-0-7b', { id: 3 }], ['x-1-0-70b', { id: 4 }]]);
  assert.equal(resolveHostModel('openai_gpt-6-luna', local), undefined);
  assert.equal(resolveHostModel('reflection_x-1-0', local), undefined);
});

test('old-style hostModelSlug values still resolve', () => {
  const local = new Map([['grok-4.6', { id: 1 }], ['gpt-6-astra', { id: 2 }]]);
  assert.equal(resolveHostModel('xai_grok-4-6-xhigh', local)?.slug, 'grok-4.6');
  assert.equal(resolveHostModel('openai_vega-alpha', local)?.slug, 'gpt-6-astra');
});
