import assert from 'node:assert/strict';
import test from 'node:test';
import type { Sql } from 'postgres';
import { PAYG_MIXES, type PaygChannelPrice, type PaygRecord } from '../src/lib/quota/pay-as-you-go';
import { paygSeedMode, seedQuotaPayg } from './seed-quota-payg';

const asOf = new Date('2026-10-15T12:00:00Z');
const channel: PaygChannelPrice = {
  id: 42, provider_slug: 'cloud', model_slug: 'model', currency: 'USD', price_unit: 'per_1m_tokens',
  input_price_per_1m: 2, cached_input_price_per_1m: 0.2, output_price_per_1m: 8,
  is_available: true, last_verified: '2026-10-14', pricing_url: 'https://example.test/prices', notes: null,
};
type Stored = PaygRecord & { id: number; is_current: boolean; superseded_by: number | null };

/** In-memory tagged-query client. No postgres client, env loading or network is used. */
function fakeDatabase(channels = [channel]) {
  const state = {
    channels, rows: [] as Stored[], nextId: 1, tablesExist: true,
    mixes: PAYG_MIXES.map(mix => ({ id: mix.id, cache_read_pct: String(mix.cacheReadPct), input_pct: String(mix.inputPct), output_pct: String(mix.outputPct) })),
    queries: [] as { query: string; values: unknown[] }[], transactions: [] as string[], failOn: '',
  };
  const execute = async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join('?').replace(/\s+/g, ' ').trim();
    state.queries.push({ query, values });
    if (state.failOn && query.includes(state.failOn)) throw new Error('injected constraint failure');
    if (query.includes('to_regclass')) return [{ estimates: state.tablesExist, mixes: state.tablesExist }];
    if (query.includes('FROM usage_mixes')) return state.mixes;
    if (query.includes('FROM api_channel_prices')) return state.channels;
    if (query.startsWith('SELECT * FROM quota_estimates')) return state.rows.filter(row => row.is_current).map(row => ({ ...row }));
    if (query.startsWith('INSERT INTO quota_estimates')) {
      const [slug, model, window, low, high, mix, confidence, verifiedAt, notes, current] = values;
      const row: Stored = {
        id: state.nextId++, plan_id: null, plan_slug: String(slug), served_model: String(model),
        window: window as 'monthly', est_tokens_low: String(low), est_tokens_high: String(high),
        usage_mix_id: String(mix), confidence: confidence as 'high', verified_at: String(verifiedAt),
        notes: String(notes), is_current: Boolean(current), superseded_by: null,
      };
      state.rows.push(row);
      return [{ id: row.id }];
    }
    if (query.startsWith('UPDATE quota_estimates SET is_current = false')) {
      const row = state.rows.find(row => row.id === values[1]);
      assert.ok(row?.is_current);
      // At the instant the old version is superseded, the replacement exists but is not current.
      assert.equal(state.rows.find(row => row.id === values[0])?.is_current, false);
      row.is_current = false;
      row.superseded_by = Number(values[0]);
      return [];
    }
    if (query.startsWith('UPDATE quota_estimates SET is_current = true')) {
      const row = state.rows.find(row => row.id === values[0]);
      assert.ok(row);
      assert.equal(state.rows.filter(other => other.is_current && other.plan_slug === row.plan_slug
        && other.served_model === row.served_model && other.usage_mix_id === row.usage_mix_id).length, 0);
      row.is_current = true;
      return [];
    }
    throw new Error(`Unexpected query: ${query}`);
  };
  const sql = Object.assign(execute, {
    begin: async (isolation: string, work: (tx: Sql) => Promise<unknown>) => {
      state.transactions.push(isolation);
      const snapshot = structuredClone(state.rows);
      try {
        const result = await work(sql as unknown as Sql);
        state.transactions.push('COMMIT');
        return result;
      } catch (error) {
        state.rows = snapshot;
        state.transactions.push('ROLLBACK');
        throw error;
      }
    },
  }) as unknown as Sql;
  return { sql, state };
}

test('CLI defaults to read-only and rejects ambiguous/unknown arguments', () => {
  assert.equal(paygSeedMode([]), 'dry-run');
  assert.equal(paygSeedMode(['--dry-run']), 'dry-run');
  assert.equal(paygSeedMode(['--db-dry-run']), 'db-dry-run');
  assert.equal(paygSeedMode(['--apply']), 'apply');
  for (const args of [['--apply', '--dry-run'], ['--apply', '--apply'], ['--unknown']]) {
    assert.throws(() => paygSeedMode(args), /Usage/);
  }
});

test('default preview performs only SELECTs and reports new rows and complete samples', async () => {
  const { sql, state } = fakeDatabase();
  const report = await seedQuotaPayg(sql, 'dry-run', asOf);
  assert.equal(report.inserted, 2);
  assert.equal(report.superseded, 0);
  assert.ok(Math.abs(report.samples[0].blendedPriceUsdPerMTok - 0.284) < 1e-12);
  assert.equal(report.samples[0].record.confidence, 'high');
  assert.equal(state.rows.length, 0);
  assert.ok(state.queries.every(entry => entry.query.startsWith('SELECT')));
  assert.deepEqual(state.transactions, ['isolation level repeatable read read only', 'COMMIT']);
  const sourceQuery = state.queries.find(entry => entry.query.includes('FROM api_channel_prices'))!;
  assert.match(sourceQuery.query, /cp.is_available = true/);
  assert.match(sourceQuery.query, /m.shutdown_date IS NULL OR m.shutdown_date > \?::date/);
  assert.doesNotMatch(sourceQuery.query, /p.type/); // Cloud, aggregator, producer and reseller rows all qualify.
});

test('rehearsal executes inserts then rolls back; apply persists and subsequent runs are idempotent', async () => {
  const { sql, state } = fakeDatabase();
  const rehearsal = await seedQuotaPayg(sql, 'db-dry-run', asOf);
  assert.equal(rehearsal.inserted, 2);
  assert.ok(state.queries.some(entry => entry.query.startsWith('INSERT')));
  assert.equal(state.rows.length, 0);
  assert.deepEqual(state.transactions, ['isolation level serializable', 'ROLLBACK']);
  await seedQuotaPayg(sql, 'apply', asOf);
  assert.equal(state.rows.length, 2);
  assert.ok(state.rows.every(row => row.is_current && row.superseded_by === null));
  state.queries = [];
  const repeated = await seedQuotaPayg(sql, 'apply', new Date('2026-10-16'));
  assert.deepEqual([repeated.inserted, repeated.superseded, repeated.unchanged], [0, 0, 2]);
  assert.ok(state.queries.every(entry => entry.query.startsWith('SELECT')));
});

test('changed prices supersede atomically and preserve all historical values and notes', async () => {
  const { sql, state } = fakeDatabase();
  await seedQuotaPayg(sql, 'apply', asOf);
  const old = structuredClone(state.rows);
  state.channels = [{ ...channel, input_price_per_1m: 3 }];
  const preview = await seedQuotaPayg(sql, 'dry-run', asOf);
  assert.deepEqual([preview.inserted, preview.superseded], [0, 2]);
  assert.deepEqual(state.rows, old);
  await seedQuotaPayg(sql, 'db-dry-run', asOf);
  assert.deepEqual(state.rows, old); // Supersession updates roll back too.
  const report = await seedQuotaPayg(sql, 'apply', asOf);
  assert.equal(report.superseded, 2);
  assert.equal(state.rows.length, 4);
  for (const original of old) {
    const historical = state.rows.find(row => row.id === original.id)!;
    const replacement = state.rows.find(row => row.id === historical.superseded_by)!;
    assert.deepEqual(historical, { ...original, is_current: false, superseded_by: replacement.id });
    assert.equal(replacement.is_current, true);
    assert.equal(replacement.usage_mix_id, original.usage_mix_id);
    assert.notEqual(replacement.notes, original.notes);
  }
});

test('a write failure rolls back even in apply mode and leaves the old current versions intact', async () => {
  const { sql, state } = fakeDatabase();
  await seedQuotaPayg(sql, 'apply', asOf);
  const original = structuredClone(state.rows);
  state.channels = [{ ...channel, output_price_per_1m: 10 }];
  state.failOn = 'UPDATE quota_estimates SET is_current = true';
  await assert.rejects(seedQuotaPayg(sql, 'apply', asOf), /constraint failure/);
  assert.deepEqual(state.rows, original);
  assert.equal(state.transactions.at(-1), 'ROLLBACK');
});

test('schema preflight errors name 0005 before any quota-table query; wrong mixes also fail before writes', async () => {
  const { sql, state } = fakeDatabase();
  state.tablesExist = false;
  await assert.rejects(seedQuotaPayg(sql, 'dry-run', asOf), /需先应用 0005/);
  assert.equal(state.queries.length, 1);
  state.tablesExist = true;
  state.mixes[0].input_pct = '3';
  await assert.rejects(seedQuotaPayg(sql, 'apply', asOf), /配比不符/);
  state.mixes = [];
  await assert.rejects(seedQuotaPayg(sql, 'db-dry-run', asOf), /0005/);
  assert.ok(state.queries.every(entry => entry.query.startsWith('SELECT')));
});

test('empty catalogs, skipped rows and duplicate source identities are handled explicitly', async () => {
  const empty = fakeDatabase([]);
  const report = await seedQuotaPayg(empty.sql, 'dry-run', asOf);
  assert.deepEqual([report.inserted, report.superseded, report.scannedChannels], [0, 0, 0]);
  const missing = fakeDatabase([{ ...channel, input_price_per_1m: null }, { ...channel, id: 43, price_unit: 'per_image' }]);
  const skipped = await seedQuotaPayg(missing.sql, 'apply', asOf);
  assert.equal(skipped.skipped.length, 2);
  assert.equal(skipped.inserted, 0);
  const duplicates = fakeDatabase([channel, { ...channel, id: 43 }]);
  await assert.rejects(seedQuotaPayg(duplicates.sql, 'apply', asOf), /Duplicate channel identity/);
  assert.equal(duplicates.state.rows.length, 0);
  assert.ok(duplicates.state.queries.every(entry => entry.query.startsWith('SELECT')));
});

test('provider/model/mix keys are independent, and CNY conversion is present in persisted notes', async () => {
  const { sql, state } = fakeDatabase([
    channel, { ...channel, id: 43, provider_slug: 'aggregator' }, { ...channel, id: 44, model_slug: 'another-model' },
    { ...channel, id: 45, provider_slug: 'cn-cloud', currency: 'CNY', cached_input_price_per_1m: null },
  ]);
  assert.equal((await seedQuotaPayg(sql, 'apply', asOf)).inserted, 8);
  const notes = JSON.parse(state.rows.find(row => row.plan_slug === 'payg:cn-cloud')!.notes);
  assert.equal(notes.original_currency, 'CNY');
  assert.match(notes.conversion.method, /getExchangeRateSync/);
  assert.match(notes.cache_handling, /missing/);
});
