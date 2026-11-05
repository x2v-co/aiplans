import assert from 'node:assert/strict';
import test from 'node:test';
import { catalogForKind } from '../../src/lib/ai-vertical-catalog';
import { CATALOG_1105, OPENAI_VOICE_1105, ASR_TTS_1105 } from '../../src/lib/catalog-2026-11-05';
import { FRESH_CUTOFF, MODEL_SLUGS, VERIFIED_AT, catalog20261105SeedOptions, keepFresher, seedCatalog20261105 } from './catalog-2026-11-05-intel';
import { fakeSeedTx, type FakeRow } from './fake-seed-tx';

function fixture(): Partial<Record<string, FakeRow[]>> {
  return {
    providers: [{ id: 1, slug: 'openai', type: 'official' }, { id: 2, slug: 'google', type: 'producer' }, { id: 3, slug: 'elevenlabs', type: 'official' }],
    plans: [
      { id: 10, slug: 'chatgpt-go', provider_id: 1, price: null, currency: 'USD', notes: 'Old note.' },
      { id: 11, slug: 'gemini-advanced', provider_id: 2, price: null, currency: null, region: 'needs-verification', notes: '[needs-verification] Plus/Pro US price not identified' },
    ],
    models: [{ id: 30, slug: 'tts-1', type: 'audio', provider_ids: [1], capabilities: ['voices'], description: 'Keep me.' }],
    usage_prices: [{ id: 40, model_id: 30, provider_id: 1, price_kind: 'text_to_speech', unit: 'per_1m_characters', price: '15', plan_id: 7 }],
  };
}
const price = (slug: string, kind?: string) => CATALOG_1105.find(i => i.slug === slug)!.usageRates!.find(r => !kind || r.priceKind === kind)!;

test('1105 CLI defaults to read-only preview and rejects unknown/conflicting arguments', () => {
  assert.equal(catalog20261105SeedOptions([]).apply, false);
  assert.equal(catalog20261105SeedOptions(['--dry-run']).apply, false);
  assert.equal(catalog20261105SeedOptions(['--apply']).apply, true);
  for (const args of [['--apply', '--dry-run'], ['--force']]) assert.throws(() => catalog20261105SeedOptions(args), /Usage/);
});

test('1105 catalog carries the officially verified voice prices and is listed under voice models', () => {
  assert.deepEqual(OPENAI_VOICE_1105.map(i => i.slug), ['gpt-live-1', 'gpt-transcribe', 'gpt-4o-transcribe', 'gpt-4o-mini-transcribe', 'gpt-live-transcribe', 'gpt-realtime-whisper', 'tts-1', 'tts-1-hd']);
  assert.equal(ASR_TTS_1105.length, 6);
  assert.equal(price('gpt-live-1').price, 0.05);
  assert.equal(price('gpt-transcribe').price, 0.0045);
  assert.deepEqual(OPENAI_VOICE_1105.find(i => i.slug === 'gpt-4o-transcribe')!.usageRates!.map(r => r.price), [2.5, 10, 0.006]);
  assert.equal(price('gpt-4o-mini-transcribe', 'transcription estimate').approximate, true);
  assert.equal(price('gpt-realtime-whisper').price, 0.017);
  assert.deepEqual([price('tts-1').price, price('tts-1-hd').price, price('tts-1').unit], [15, 30, 'per_1m_characters']);
  assert.deepEqual([price('elevenlabs-scribe-v2').price, price('elevenlabs-scribe-v2-realtime').price, price('elevenlabs-scribe-v2').unit], [0.22, 0.39, 'hour']);
  assert.deepEqual([price('deepgram-nova-3').price, price('deepgram-aura-2').price, price('deepgram-aura-2').unit], [0.0077, 0.03, 'per_1k_characters']);
  assert.deepEqual([price('assemblyai-universal-3-5-pro').price, price('assemblyai-universal-2').price], [0.21, 0.15]);
  const voice = new Set(catalogForKind('voice-model').map(i => i.slug));
  for (const item of CATALOG_1105) {
    assert.ok(voice.has(item.slug), item.slug);
    assert.equal(item.lastVerified, '2026-11-05');
    assert.match(item.sourceUrls![0].url, /^https:\/\/(platform\.openai\.com|elevenlabs\.io|deepgram\.com|www\.assemblyai\.com)\//);
  }
  assert.equal(new Set(MODEL_SLUGS).size, MODEL_SLUGS.length);
});

test('1105 preview writes nothing; apply sets plan prices, creates missing providers and keeps existing rows intact', async () => {
  const preview = fakeSeedTx(fixture());
  const steps = await seedCatalog20261105(preview.tx, false);
  assert.equal(preview.writes(), 0);
  assert.deepEqual(steps.filter(s => s.table === 'providers').map(s => s.target).sort(), ['assemblyai', 'deepgram']);
  const f = fakeSeedTx(fixture());
  await seedCatalog20261105(f.tx, true);
  const plan = (slug: string) => f.data.plans.find(r => r.slug === slug)!;
  assert.deepEqual([plan('gemini-advanced').price, plan('gemini-advanced').currency, plan('gemini-advanced').region], [19.99, 'USD', 'US']);
  assert.deepEqual([plan('chatgpt-go').price, plan('chatgpt-go').currency], [8, 'USD']);
  assert.match(String(plan('chatgpt-go').notes), /^Old note\.\n.*\$8.*2026-11-03/s);
  const tts = f.data.models.find(r => r.slug === 'tts-1')!;
  assert.equal(tts.type, 'audio');
  assert.deepEqual(tts.capabilities, ['voices', 'TTS']);
  assert.match(String(tts.description), /^Keep me\./);
  const ttsPrices = f.data.usage_prices.filter(r => r.model_id === 30);
  assert.equal(ttsPrices.length, 1);
  assert.equal(ttsPrices[0].plan_id, 7);
  const deepgram = f.data.providers.find(r => r.slug === 'deepgram')!;
  const nova = f.data.models.find(r => r.slug === 'deepgram-nova-3')!;
  assert.deepEqual(nova.provider_ids, [deepgram.id]);
  assert.ok(f.data.usage_prices.some(r => r.model_id === nova.id && r.price === 0.0077 && r.unit === 'minute'));
  const again = fakeSeedTx(f.data);
  assert.equal((await seedCatalog20261105(again.tx, false)).length, 0);
});

test('1105 refuses ambiguous or wrongly owned plans before any write', async () => {
  const wrong = fixture();
  wrong.plans![1].provider_id = 1;
  const f = fakeSeedTx(wrong);
  await assert.rejects(seedCatalog20261105(f.tx, true), /Wrong plans\/gemini-advanced/);
  assert.equal(f.writes(), 0);
  const missing = fixture();
  missing.plans = missing.plans!.slice(0, 1);
  await assert.rejects(seedCatalog20261105(fakeSeedTx(missing).tx, true), /missing plans\/gemini-advanced/);
});

test('1105 keepFresher preserves same-day verification and notes', () => {
  const fresh = { id: 1, last_verified: new Date(FRESH_CUTOFF.getTime() + 1000).toISOString() };
  assert.deepEqual(keepFresher(fresh, { price: 1, notes: 'x', last_verified: VERIFIED_AT }), { price: 1 });
  assert.deepEqual(keepFresher({ id: 1, last_verified: '2026-11-03' }, { price: 1, notes: 'x' }), { price: 1, notes: 'x' });
});
