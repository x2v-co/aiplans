import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { VOYAGE_CATALOG_1126 } from '../../src/lib/catalog-2026-11-26-voyage';
import { verticalModelDescription } from './catalog-audit-vertical';
import { fakeSeedTx } from './fake-seed-tx';
import { runRehearsable } from '../db/rehearsal';
import { voyageCopyProductionFixture } from './catalog-2026-11-26-voyage-copy-fixture';
import { copySeedStepCounts, PRODUCTION_SHAPED_DRY_RUN, seedVoyageCopy1126, voyageCopyDescription, voyageCopySeedOptions } from './catalog-2026-11-26-voyage-copy';

const source = (path: string) => readFileSync(path, 'utf8');

test('literal production dump agrees with original seed reconstruction and unchanged official billing facts', () => {
  const fixture = voyageCopyProductionFixture();
  assert.equal(fixture.models.length, 6);
  for (const [i, item] of VOYAGE_CATALOG_1126.entries()) {
    assert.equal(fixture.models[i].description, verticalModelDescription(item));
    assert.equal(fixture.usage_prices[i].constraints_json.note, item.notes);
  }
  const protectedHashes = {
    'src/lib/catalog-2026-11-26-voyage.ts': 'fd408937e7f106ab7858557fab840edeca2730c83a3e045e37d201e3331d3b3b',
    'scripts/data/catalog-2026-11-26-voyage.ts': '5034e03f46202362c794295c56ddba3fbe6f82984523c5f3b6d595dbe04e20fa',
    'scripts/seed-catalog-2026-11-26-voyage.ts': '9d5bc0e10e7c399e67825cb27f6ea91bc9e2a641abb13deaad8782c08b5102b1',
    'src/lib/catalog-2026-11-06-embeddings.ts': 'bef8b810c9adf98e3dc9fb25c76bb603083c25267f471c8186e5ae48a1e4795c',
    'scripts/data/catalog-2026-11-06-embeddings.ts': '773aed5cc8af969d7a91b96f353f80c0c76a8592eacf3c97a5a0f8724a93e4da',
    'scripts/data/catalog-2026-11-06-embeddings.test.ts': 'd546028ed11c5d72ded801eb9e409a5939f35106972fdf83eff92fa6402ca60b',
    'scripts/seed-catalog-2026-11-06-embeddings.ts': '1fa5f3f5c75e56e9d5ce6862fc10be099d32758ba64cf536f0e20152dcad0ba7',
  };
  for (const [path, hash] of Object.entries(protectedHashes)) {
    assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'), hash, path);
  }
});

test('production-shaped plan has six description updates, no price updates/inserts; replace-not-append; idempotent', async () => {
  const f = fakeSeedTx(voyageCopyProductionFixture());
  const before = structuredClone(f.data);
  const preview = await seedVoyageCopy1126(f.tx);
  assert.deepEqual(copySeedStepCounts(preview), PRODUCTION_SHAPED_DRY_RUN);
  assert.equal(f.writes(), 0);
  const steps = await seedVoyageCopy1126(f.tx, true);
  assert.deepEqual(steps, preview);
  assert.equal(f.writes(), 6);
  assert.deepEqual(f.data.usage_prices, before.usage_prices);
  assert.deepEqual(f.data.providers, before.providers);
  for (const [i, model] of f.data.models.entries()) {
    const expected = `${VOYAGE_CATALOG_1126[i].bestFor}\nStatus: available. Pricing confidence: verified. Unit: per_1m_tokens. Last verified: 2026-11-26.\nSources: Voyage AI: https://docs.voyageai.com/docs/pricing`;
    assert.equal(model.description, expected);
    assert.deepEqual(model, { ...before.models[i], description: expected });
    assert.deepEqual(Object.keys(steps[i].changes), ['description']);
  }
  assert.deepEqual(await seedVoyageCopy1126(f.tx, true), []);
  assert.equal(f.writes(), 6);
  f.data.models[0].description += '\nUnexpected extra text\n' + before.models[0].description;
  assert.equal((await seedVoyageCopy1126(f.tx, true)).length, 1);
  assert.equal(f.data.models[0].description, voyageCopyDescription(VOYAGE_CATALOG_1126[0]));
});

test('note replacement preserves every other JSON key and column, and never touches unrelated models/prices', async () => {
  const f = fakeSeedTx(voyageCopyProductionFixture());
  const row = f.data.usage_prices[2];
  row.constraints_json = { ...(row.constraints_json as object), note: 'Unexpected old note', custom: { nested: [1, 'keep'] } };
  f.data.models.push({ id: 999, slug: 'voyage-4', description: 'unchanged' });
  f.data.usage_prices.push({ id: 999, model_id: 999, price: 99, unit: 'per_1m_tokens' });
  const before = structuredClone(f.data);
  const steps = await seedVoyageCopy1126(f.tx, true);
  assert.deepEqual(copySeedStepCounts(steps), { ...PRODUCTION_SHAPED_DRY_RUN, usage_prices: { insert: 0, update: 1 } });
  assert.deepEqual(row, { ...before.usage_prices[2], constraints_json: {
    ...(before.usage_prices[2].constraints_json as object), note: VOYAGE_CATALOG_1126[2].notes,
  } });
  assert.deepEqual(f.data.models.at(-1), before.models.at(-1));
  assert.deepEqual(f.data.usage_prices.at(-1), before.usage_prices.at(-1));
  assert.deepEqual(await seedVoyageCopy1126(f.tx, true), []);
});

test('missing/ambiguous identities or malformed constraints abort before any writes, even for the last model', async () => {
  for (const mutate of [
    (f: ReturnType<typeof fakeSeedTx>) => { f.data.providers = []; },
    (f: ReturnType<typeof fakeSeedTx>) => { f.data.providers.push({ ...f.data.providers[0], id: 43 }); },
    (f: ReturnType<typeof fakeSeedTx>) => { f.data.providers[0].type = 'aggregator'; },
    (f: ReturnType<typeof fakeSeedTx>) => { f.data.models.pop(); },
    (f: ReturnType<typeof fakeSeedTx>) => { f.data.models.push({ ...f.data.models[5], id: 999 }); },
    (f: ReturnType<typeof fakeSeedTx>) => { f.data.usage_prices.pop(); },
    (f: ReturnType<typeof fakeSeedTx>) => { f.data.usage_prices.push({ ...f.data.usage_prices[5], id: 999 }); },
    (f: ReturnType<typeof fakeSeedTx>) => { f.data.usage_prices[5].unit = 'per_request'; },
    (f: ReturnType<typeof fakeSeedTx>) => { f.data.usage_prices[5].plan_id = 9; },
    (f: ReturnType<typeof fakeSeedTx>) => { f.data.usage_prices[5].provider_id = 99; },
    (f: ReturnType<typeof fakeSeedTx>) => { f.data.usage_prices[5].constraints_json = null; },
  ]) {
    const f = fakeSeedTx(voyageCopyProductionFixture());
    mutate(f);
    const before = structuredClone(f.data);
    await assert.rejects(seedVoyageCopy1126(f.tx, true), /Ambiguous|Unexpected/);
    assert.equal(f.writes(), 0);
    assert.deepEqual(f.data, before);
  }
});

test('serializable offline rehearsal exercises writes then rolls back, propagates failures; apply commits', async () => {
  for (const apply of [false, true]) {
    const f = fakeSeedTx(voyageCopyProductionFixture());
    const before = structuredClone(f.data);
    const events: string[] = [];
    const sql = { async begin(isolation: string, work: (tx: typeof f.tx) => Promise<unknown>) {
      assert.equal(isolation, 'isolation level serializable');
      events.push('BEGIN');
      try { const result = await work(f.tx); events.push('COMMIT'); return result; }
      catch (error) { Object.assign(f.data, structuredClone(before)); events.push('ROLLBACK'); throw error; }
    } };
    const steps = await runRehearsable(sql, apply, tx => seedVoyageCopy1126(tx, true));
    assert.deepEqual(copySeedStepCounts(steps), PRODUCTION_SHAPED_DRY_RUN);
    assert.equal(f.writes(), 6);
    assert.deepEqual(events, ['BEGIN', apply ? 'COMMIT' : 'ROLLBACK']);
    if (!apply) assert.deepEqual(f.data, before);
    await assert.rejects(runRehearsable(sql, false, async () => { throw new Error('constraint failure'); }), /constraint failure/);
  }
});

test('CLI is offline by default, rejects invalid options, requires explicit DB URL; manual npm scripts only', () => {
  assert.deepEqual(voyageCopySeedOptions([]), { apply: false, db: false });
  assert.deepEqual(voyageCopySeedOptions(['--db']), { apply: false, db: true });
  assert.deepEqual(voyageCopySeedOptions(['--apply']), { apply: true, db: true });
  for (const args of [['--bogus'], ['--apply', '--dry-run']]) assert.throws(() => voyageCopySeedOptions(args), /Usage:/);
  const env = { ...process.env, DATABASE_URL: '' };
  for (const args of [[], ['--dry-run']]) {
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/seed-catalog-2026-11-26-voyage-copy.ts', ...args], { encoding: 'utf8', env });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /OFFLINE.*rolled back/);
    assert.match(result.stdout, /shape expectation, not a measured production dry-run/);
    assert.match(result.stdout, /"update": 6/);
  }
  for (const args of [['--db'], ['--apply']]) {
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/seed-catalog-2026-11-26-voyage-copy.ts', ...args], { encoding: 'utf8', env });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /requires an explicit DATABASE_URL/);
  }
  const scripts = JSON.parse(source('package.json')).scripts;
  assert.equal(scripts['seed:catalog-2026-11-26-voyage-copy'], 'tsx scripts/seed-catalog-2026-11-26-voyage-copy.ts');
  assert.equal(scripts['seed:catalog-2026-11-26-voyage-copy:apply'], 'tsx scripts/seed-catalog-2026-11-26-voyage-copy.ts --apply');
  assert.doesNotMatch(source('deploy/production/seed-catalog.sh'), /voyage-copy/);
  assert.doesNotMatch(source('scripts/seed-catalog-2026-11-26-voyage-copy.ts'), /import.*dotenv|\.env\.local|postgres-admin/);
});
