import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { GET } from '../app/api/citable-prices/route';
import { normalizeChannelQuote, prepareQuotes, snapshotToCsv, type RawChannelQuote } from './citable-price-facts';
import { analyzeObservations, classifyPriceHistoryRow, renderRadarDraft, type HistoryRow } from './price-change-radar';
import { loadRadarInput } from './price-radar-input';

// Every value in this test file is synthetic, not_market_data. No URLs are fetched.
const clock = new Date('2026-11-01T00:00:00Z');
const fixtureOptions = { allowFixture: true, asOf: clock, generatedAt: clock };
function row(overrides: Record<string, unknown> = {}): RawChannelQuote {
  return {
    model_slug: 'fixture-alpha', model_name: 'Synthetic Alpha', provider_slug: 'fixture-producer', provider_name: 'Synthetic Producer',
    provider_type: 'producer', source_url: 'https://pricing.synthetic-provider.dev/pricing/alpha',
    currency: 'USD', price_unit: 'per_1m_tokens', input_price_per_1m: 2, output_price_per_1m: 8,
    last_verified: '2026-10-25T00:00:00Z', is_available: true,
    is_public: true, is_self_service: true, is_partner_only: false, data_for_discount: false,
    constraints_json: { processing: 'standard', prompt_tokens_lte: 100000, time_window: 'peak', peak_schedule: '08:00-16:00 UTC' },
    sample: 'synthetic_fixture', ...overrides,
  };
}
function history(overrides: Record<string, unknown> = {}): HistoryRow {
  const conditions = prepareQuotes([row()], fixtureOptions).publishable[0].billing_conditions;
  return {
    model_slug: 'fixture-alpha', provider_slug: 'fixture-producer', sample: 'synthetic_fixture',
    old_currency: 'USD', new_currency: 'USD', old_price_unit: 'per_1m_tokens', new_price_unit: 'per_1m_tokens',
    old_billing_conditions: conditions, new_billing_conditions: conditions,
    old_input_price: 2, new_input_price: 3, old_output_price: 8, new_output_price: 8,
    source_url_previous: row().source_url, source_url_current: row().source_url,
    verified_at_previous: row().last_verified, verified_at_current: row().last_verified,
    previous_eligibility: row(), current_eligibility: row(), ...overrides,
  };
}

test('researched constraints, processing, windows, prompt bands and notes participate in identity', () => {
  const previous = prepareQuotes([row()], fixtureOptions);
  const constraints = row().constraints_json as Record<string, unknown>;
  for (const changes of [
    { constraints_json: { ...constraints, prompt_tokens_lte: 200000 } },
    { constraints_json: { ...constraints, processing: 'batch' } },
    { constraints_json: { ...constraints, time_window: 'off-peak' } },
    { constraints_json: { ...constraints, peak_schedule: '09:00-17:00 UTC' } },
    { channel_notes: 'Only prompts up to 100K; see variants for longer prompts.' },
    { variant_notes: 'Only self-service processing in this window.' },
  ]) {
    const current = prepareQuotes([row({ ...changes, input_price_per_1m: 3 })], fixtureOptions);
    const report = analyzeObservations(previous.observations, current.observations, { fixture: true, asOf: clock });
    assert.equal(report.publishable_events.length, 0);
    assert.equal(report.withheld[0].reason, 'condition_changed');
  }
  const conditions = previous.publishable[0].billing_conditions;
  assert.match(conditions, /prompt_tokens_lte.*100000/);
  assert.match(conditions, /peak_schedule/);
  for (const constraints_json of [undefined, null, {}, 'invalid json']) {
    const missing = prepareQuotes([row({ constraints_json })], fixtureOptions);
    assert.equal(missing.publishable.length, 0);
    assert.equal(missing.rejections[0].reason, 'scope_unestablished');
  }
});

test('homepage, website-only, unknown visibility and absent verification cannot establish eligibility', () => {
  for (const overrides of [
    { source_url: 'https://pricing.synthetic-provider.dev/' },
    { source_url: undefined, pricing_url: 'https://pricing.synthetic-provider.dev/' },
    { source_url: undefined, website: 'https://pricing.synthetic-provider.dev/pricing' },
    { is_public: undefined }, { is_self_service: null }, { is_partner_only: true }, { data_for_discount: undefined },
    { last_verified: undefined }, { last_verified: '2099-01-01' },
  ]) assert.equal(prepareQuotes([row(overrides)], fixtureOptions).publishable.length, 0);
  assert.equal(prepareQuotes([row({ source_url: undefined, pricing_url: 'https://pricing.synthetic-provider.dev/pricing' })], fixtureOptions).publishable.length, 1);
  assert.equal(prepareQuotes([row({ sample: undefined, source_url: 'https://example.test/pricing' })], { asOf: clock }).rejections[0].reason, 'fixture_source_blocked');
});

test('unpublished live redistribution empties the JSON/CSV export despite eligible prices', async () => {
  for (const redistribution of [undefined, { status: 'unknown' }, { status: 'unpublished' }]) {
    const prepared = prepareQuotes([row({ sample: undefined, redistribution })], { asOf: clock });
    assert.deepEqual(prepared.publishable, []);
    assert.deepEqual(prepared.snapshot.quotes, []);
    assert.equal(prepared.snapshot.empty_export_reason, 'redistribution_scope_unpublished');
    assert.equal(prepared.snapshot.redistribution.granted_license, null);
    assert.equal(prepared.snapshot.redistribution.cc0, false);
    assert.equal(prepared.snapshot.redistribution.mit, false);
    const csv = snapshotToCsv(prepared.snapshot);
    assert.equal(csv.charCodeAt(0), 0xfeff);
    assert.match(csv, /# snapshot_id,sha256:/);
    assert.match(csv, /# granted_license,null/);
    assert.match(csv, /# cc0,false/);
    assert.match(csv, /# mit,false/);
    assert.match(csv, /redistribution_scope_unpublished/);
    assert.match(csv, /does not grant a CC0, MIT/);
    assert.equal(csv.includes('fixture-alpha'), false);
  }
  for (const format of ['json', 'csv']) {
    const response = await GET(new Request(`https://aiplans.dev/api/citable-prices?format=${format}`));
    assert.equal(response.status, 200);
    const body = await response.text();
    assert.match(body, /redistribution_scope_unpublished/);
    if (format === 'json') {
      const downloaded = JSON.parse(body);
      assert.deepEqual(downloaded.quotes, []);
      assert.equal(loadRadarInput(downloaded, new Date()).publishable.length, 0);
    }
    else assert.match(body, /# snapshot_id,/);
  }
});

test('bilaterally complete history must pass official/public/source and redistribution gates on both sides', () => {
  for (const side of ['previous_eligibility', 'current_eligibility']) {
    for (const metadata of [{ provider_type: 'aggregator' }, { is_public: false }, { is_self_service: false }, { is_partner_only: true }, { data_for_discount: true }]) {
      const result = classifyPriceHistoryRow(history({ [side]: row(metadata) }), { asOf: clock, fixture: true });
      assert.equal(result.event, null);
      assert.match(result.reason, /non_official_channel|restricted_or_nonpublic/);
    }
  }
  assert.equal(classifyPriceHistoryRow(history({ source_url_current: 'https://pricing.synthetic-provider.dev/' }), { asOf: clock, fixture: true }).reason, 'invalid_source');
  for (const redistribution of [undefined, { status: 'unknown' }, { status: 'unpublished' }]) {
    const result = classifyPriceHistoryRow(history({ sample: undefined, previous_eligibility: row({ redistribution }), current_eligibility: row({ redistribution }) }), { asOf: clock });
    assert.equal(result.event, null);
    assert.equal(result.reason, 'redistribution_scope_unpublished');
  }
  const report = analyzeObservations([], [], { asOf: clock }, [history({ sample: undefined })]);
  assert.equal(report.history_publishable_events.length, 0);
  assert.match(renderRadarDraft(report, 'en'), /redistribution_scope_unpublished: 1/);
});

test('replacement_model on the retiring row points forward, including on the withheld live path', () => {
  const previous = prepareQuotes([row({ sample: undefined, model_slug: 'fixture-v1', replacement_model: 'fixture-v2', shutdown_date: '2026-11-02' })], { asOf: clock });
  const current = prepareQuotes([row({ sample: undefined, model_slug: 'fixture-v2', input_price_per_1m: 3 })], { asOf: clock });
  assert.equal(previous.observations[0].replaces_model_slug, '');
  assert.equal(previous.observations[0].successor_model_slug, 'fixture-v2');
  const report = analyzeObservations(previous.observations, current.observations, { asOf: clock });
  assert.equal(report.publishable_events.length, 0);
  assert.deepEqual(report.withheld.map((item) => item.reason), ['version_replaced']);
  assert.equal(normalizeChannelQuote(row({ replacement_model: 'fixture-v2' }), fixtureOptions).observation?.replaces_model_slug, '');
});

test('downloaded snapshots verify their digest, permit differing as_of and retain synthetic +50% banners', () => {
  const previous = prepareQuotes([row()], fixtureOptions).snapshot;
  const current = prepareQuotes([row({ input_price_per_1m: 3 })], fixtureOptions).snapshot;
  previous.as_of = '2026-10-31T00:00:00Z';
  const loadedPrevious = loadRadarInput(JSON.parse(JSON.stringify(previous)), clock);
  const loadedCurrent = loadRadarInput(JSON.parse(JSON.stringify(current)), clock);
  const report = analyzeObservations(loadedPrevious.observations, loadedCurrent.observations, { fixture: loadedCurrent.fixture, asOf: clock });
  assert.equal(report.publishable_events[0].components[0].change_percent, 50);
  assert.equal(report.not_market_data, true);
  assert.match(renderRadarDraft(report, 'en'), /Synthetic fixture.*not market data/);
  assert.match(renderRadarDraft(report, 'en'), /do not send/i);
  assert.throws(() => loadRadarInput({ ...current, snapshot_id: 'sha256:tampered' }, clock), /digest mismatch/);
  const tampered = structuredClone(current);
  tampered.quotes[0].input_price = 999;
  assert.throws(() => loadRadarInput(tampered, clock), /digest mismatch/);
  const nonFixture = { ...current, sample_kind: 'live_official', not_market_data: false, redistribution: { ...current.redistribution, status: 'unknown' } };
  const live = loadRadarInput(nonFixture, clock);
  assert.equal(live.publishable.length, 0);
  assert.equal(live.observations[0].withhold, 'redistribution_scope_unpublished');
  assert.equal(analyzeObservations(live.observations, live.observations, { asOf: clock }).publishable_events.length, 0);
});

test('radar CLI accepts downloaded JSON and rejects tamper, all without DATABASE_URL', () => {
  const dir = mkdtempSync(join(tmpdir(), 'citable-blockers-'));
  const env = { ...process.env };
  delete env.DATABASE_URL;
  delete env.NODE_TEST_CONTEXT;
  try {
    const previous = prepareQuotes([row()], fixtureOptions).snapshot;
    const current = prepareQuotes([row({ input_price_per_1m: 3 })], fixtureOptions).snapshot;
    previous.as_of = '2026-10-31T00:00:00Z';
    const previousPath = join(dir, 'previous.json');
    const currentPath = join(dir, 'current.json');
    writeFileSync(previousPath, JSON.stringify(previous));
    writeFileSync(currentPath, JSON.stringify(current));
    const args = ['--import', 'tsx', 'scripts/price-change-radar.ts', '--previous', previousPath, '--current', currentPath, '--as-of', clock.toISOString(), '--out', join(dir, 'drafts')];
    const run = spawnSync(process.execPath, args, { env, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    const report = JSON.parse(readFileSync(join(dir, 'drafts/report.json'), 'utf8'));
    assert.equal(report.fixture, true);
    assert.equal(report.publishable_events[0].components[0].change_percent, 50);
    const livePath = join(dir, 'unpublished.json');
    const live = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/export-citable-prices.ts', '--live', '--out', livePath], { env, encoding: 'utf8' });
    assert.equal(live.status, 0, live.stderr);
    const liveSnapshot = JSON.parse(readFileSync(livePath, 'utf8'));
    assert.deepEqual(liveSnapshot.quotes, []);
    assert.equal(liveSnapshot.empty_export_reason, 'redistribution_scope_unpublished');
    const liveDraftDir = join(dir, 'unpublished-drafts');
    const liveRadar = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/price-change-radar.ts', '--baseline', '--current', livePath, '--out', liveDraftDir], { env, encoding: 'utf8' });
    assert.equal(liveRadar.status, 0, liveRadar.stderr);
    assert.equal(JSON.parse(readFileSync(join(liveDraftDir, 'report.json'), 'utf8')).redistribution, 'unpublished');
    writeFileSync(currentPath, JSON.stringify({ ...current, snapshot_id: 'tampered' }));
    const tampered = spawnSync(process.execPath, args, { env, encoding: 'utf8' });
    assert.equal(tampered.status, 1);
    assert.equal(JSON.parse(readFileSync(join(dir, 'drafts/report.json'), 'utf8')).current_snapshot_id, current.snapshot_id);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('live loader selects existing variant restrictions and researched notes rather than website provenance', () => {
  const query = readFileSync(new URL('./citable-price-query.ts', import.meta.url), 'utf8');
  for (const field of ['constraints_json', 'source_url', 'is_public', 'is_self_service', 'is_partner_only', 'last_verified']) assert.ok(query.includes(`v.${field}`), field);
  assert.match(query, /c\.notes AS channel_notes/);
  assert.match(query, /v\.notes AS variant_notes/);
  assert.match(query, /c\.data_for_discount/);
  assert.equal(query.includes('p.website'), false);
});

test('downloaded snapshots reapply promo expiry at the comparison clock, matching raw rows', () => {
  const promo = {
    promo_ends_at: '2026-11-02T00:00:00Z',
    regular_input_price_per_1m: 10,
    regular_output_price_per_1m: 10,
  };
  const snapClock = new Date('2026-11-01T00:00:00Z');
  const cmpClock = new Date('2026-11-03T00:00:00Z');
  const previous = prepareQuotes([row(promo)], { allowFixture: true, asOf: snapClock, generatedAt: snapClock }).snapshot;
  const current = prepareQuotes([row({ ...promo, input_price_per_1m: 3 })], { allowFixture: true, asOf: snapClock, generatedAt: snapClock }).snapshot;
  assert.equal(previous.quotes[0].input_price, 2);
  assert.equal(previous.quotes[0].promo_active, true);
  const rawPrevious = prepareQuotes([row(promo)], { allowFixture: true, asOf: cmpClock, generatedAt: cmpClock });
  const rawCurrent = prepareQuotes([row({ ...promo, input_price_per_1m: 3 })], { allowFixture: true, asOf: cmpClock, generatedAt: cmpClock });
  const rawReport = analyzeObservations(rawPrevious.observations, rawCurrent.observations, { fixture: true, asOf: cmpClock });
  const loadedPrevious = loadRadarInput(JSON.parse(JSON.stringify(previous)), cmpClock);
  const loadedCurrent = loadRadarInput(JSON.parse(JSON.stringify(current)), cmpClock);
  const loadedReport = analyzeObservations(loadedPrevious.observations, loadedCurrent.observations, { fixture: true, asOf: cmpClock });
  assert.equal(rawReport.publishable_events.length, 0);
  assert.equal(loadedReport.publishable_events.length, 0);
  assert.equal(loadedPrevious.observations[0].input_price, 10);
  assert.equal(loadedCurrent.observations[0].input_price, 10);
  assert.equal(loadedPrevious.observations[0].promo_active, false);
  assert.equal(loadedPrevious.snapshot.quotes[0].input_price, 2);
  assert.equal(loadedPrevious.snapshot.snapshot_id, previous.snapshot_id);

  const noRegular = { promo_ends_at: '2026-11-02T00:00:00Z' };
  const rawMissing = prepareQuotes([row(noRegular)], { allowFixture: true, asOf: cmpClock, generatedAt: cmpClock });
  assert.equal(rawMissing.rejections[0].reason, 'expired_promo_without_regular');
  const savedMissingPrevious = prepareQuotes([row(noRegular)], { allowFixture: true, asOf: snapClock, generatedAt: snapClock }).snapshot;
  const savedMissingCurrent = prepareQuotes([row({ ...noRegular, input_price_per_1m: 3 })], { allowFixture: true, asOf: snapClock, generatedAt: snapClock }).snapshot;
  const missingPrevious = loadRadarInput(JSON.parse(JSON.stringify(savedMissingPrevious)), cmpClock);
  const missingCurrent = loadRadarInput(JSON.parse(JSON.stringify(savedMissingCurrent)), cmpClock);
  assert.equal(missingPrevious.rejections[0].reason, 'expired_promo_without_regular');
  assert.equal(missingCurrent.rejections[0].reason, 'expired_promo_without_regular');
  assert.equal(missingPrevious.excluded_counts.expired_promo_without_regular, 1);
  assert.equal(missingPrevious.observations.length, 0);
  assert.equal(analyzeObservations(missingPrevious.observations, missingCurrent.observations, { fixture: true, asOf: cmpClock }).publishable_events.length, 0);
});

test('downloaded snapshots reject post-expiry identity collisions the same way raw rows do', () => {
  const snapClock = new Date('2026-11-01T00:00:00Z');
  const cmpClock = new Date('2026-11-03T00:00:00Z');
  const previousRows = [
    row({ promo_ends_at: '2026-11-02T00:00:00Z', regular_input_price_per_1m: 10, regular_output_price_per_1m: 10 }),
    row({ promo_ends_at: '2026-11-02T12:00:00Z', input_price_per_1m: 4, regular_input_price_per_1m: 20, regular_output_price_per_1m: 10 }),
  ];
  const currentRows = [row({ promo_ends_at: '2026-11-02T00:00:00Z', input_price_per_1m: 3, regular_input_price_per_1m: 30, regular_output_price_per_1m: 10 })];
  const savedPrevious = prepareQuotes(previousRows, { allowFixture: true, asOf: snapClock, generatedAt: snapClock }).snapshot;
  const savedCurrent = prepareQuotes(currentRows, { allowFixture: true, asOf: snapClock, generatedAt: snapClock }).snapshot;
  assert.equal(savedPrevious.quotes.length, 2);
  const rawPrevious = prepareQuotes(previousRows, { allowFixture: true, asOf: cmpClock, generatedAt: cmpClock });
  const rawCurrent = prepareQuotes(currentRows, { allowFixture: true, asOf: cmpClock, generatedAt: cmpClock });
  const rawReport = analyzeObservations(rawPrevious.observations, rawCurrent.observations, { fixture: true, asOf: cmpClock });
  const loadedPrevious = loadRadarInput(JSON.parse(JSON.stringify(savedPrevious)), cmpClock);
  const loadedCurrent = loadRadarInput(JSON.parse(JSON.stringify(savedCurrent)), cmpClock);
  const loadedReport = analyzeObservations(loadedPrevious.observations, loadedCurrent.observations, { fixture: true, asOf: cmpClock });
  assert.equal(rawPrevious.rejections[0].reason, 'ambiguous_duplicate');
  assert.equal(loadedPrevious.rejections[0].reason, 'ambiguous_duplicate');
  assert.equal(rawPrevious.observations.length, 0);
  assert.equal(loadedPrevious.observations.length, 0);
  assert.equal(rawPrevious.excluded_counts.ambiguous_duplicate, 1);
  assert.equal(loadedPrevious.excluded_counts.ambiguous_duplicate, 1);
  assert.equal(rawReport.publishable_events.length, 0);
  assert.equal(loadedReport.publishable_events.length, 0);
  assert.equal(loadedPrevious.snapshot.quotes.length, 2);
  assert.equal(loadedPrevious.snapshot.snapshot_id, savedPrevious.snapshot_id);
});
