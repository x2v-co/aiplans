import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { assessTrust } from '../../src/lib/data-trust';
import { fakeSeedTx, type FakeRow } from './fake-seed-tx';
import { ALLOWED_FIELDS, NOTE, PLUS_SOURCE, VERIFIED_AT, googleAiPlusSeedOptions, seedGoogleAiPlus20261105 } from './google-ai-plus-2026-11-05';

const OLD_NOTES = '[needs-verification] Plus/Pro US price not identified on the page; prices withheld. Source: https://gemini.google/subscriptions/\nUS monthly price $4.99. Verified 2026-11-04. Source: https://gemini.google/us/subscriptions/?hl=en';
const prod = (): FakeRow => ({ id: 1960, slug: 'google-ai-plus', provider_id: 35, product_id: null, price: 4.99, currency: 'USD', price_unit: 'per_month',
  region: 'needs-verification', last_verified: new Date('2026-11-04T00:00:00Z'), notes: OLD_NOTES, source: 'manual', tier: 'basic', access_from_china: false, plan_kind: 'chat' });
const fixture = () => ({ providers: [{ id: 35, slug: 'google', type: 'producer' }], plans: [prod(), { id: 11, slug: 'gemini-advanced', provider_id: 35, notes: '[needs-verification] untouched' }] });
const unverified = (row: FakeRow) => assessTrust({ locale: 'en', kind: 'list_price', sourceLabel: 'Official', sourceUrl: PLUS_SOURCE,
  verifiedAt: row.last_verified as Date, notes: row.notes as string, now: new Date('2026-11-06T00:00:00Z') }).flags.unverified;

test('google-ai-plus CLI defaults to rehearsal and rejects unknown/conflicting args', () => {
  assert.equal(googleAiPlusSeedOptions([]).apply, false);
  assert.equal(googleAiPlusSeedOptions(['--dry-run']).apply, false);
  assert.equal(googleAiPlusSeedOptions(['--apply']).apply, true);
  for (const args of [['--apply', '--dry-run'], ['--force']]) assert.throws(() => googleAiPlusSeedOptions(args), /Usage/);
});

test('google-ai-plus seed fixes only allowed fields on the one row and clears the badge', async () => {
  const f = fakeSeedTx(fixture());
  assert.equal(unverified(f.data.plans[0]), true);
  const steps = await seedGoogleAiPlus20261105(f.tx);
  assert.equal(steps.length, 1);
  assert.deepEqual(Object.keys(steps[0].changes).sort(), ['last_verified', 'notes', 'region']);
  for (const key of Object.keys(steps[0].changes)) assert.ok((ALLOWED_FIELDS as readonly string[]).includes(key));
  const row = f.data.plans.find(r => r.slug === 'google-ai-plus')!;
  const { notes, region, last_verified, updated_at, ...rest } = row;
  const { notes: _n, region: _r, last_verified: _l, ...before } = prod();
  assert.deepEqual(rest, before);
  assert.ok(updated_at instanceof Date);
  assert.equal(region, 'US');
  assert.deepEqual(last_verified, VERIFIED_AT);
  assert.equal(notes, NOTE);
  assert.doesNotMatch(String(notes), /needs-verification|withheld/);
  assert.equal(unverified(row), false);
  assert.equal(f.data.plans.find(r => r.slug === 'gemini-advanced')!.notes, '[needs-verification] untouched');
  assert.deepEqual(await seedGoogleAiPlus20261105(f.tx), [], 'idempotent');
});

test('google-ai-plus seed keeps unrelated note lines and refuses wrong/missing rows', async () => {
  const f = fakeSeedTx({ ...fixture(), plans: [{ ...prod(), notes: `Keep me.\n${OLD_NOTES}` }] });
  await seedGoogleAiPlus20261105(f.tx);
  assert.equal(f.data.plans[0].notes, `Keep me.\n${NOTE}`);
  await assert.rejects(seedGoogleAiPlus20261105(fakeSeedTx({ ...fixture(), plans: [{ ...prod(), provider_id: 99 }] }).tx), /Wrong plans\/google-ai-plus/);
  await assert.rejects(seedGoogleAiPlus20261105(fakeSeedTx({ ...fixture(), plans: [] }).tx), /missing plans\/google-ai-plus/);
});

test('google-ai-plus npm scripts are wired to the rehearsal CLI', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.equal(pkg.scripts['seed:google-ai-plus-2026-11-05'], 'tsx scripts/seed-google-ai-plus-2026-11-05.ts');
  assert.equal(pkg.scripts['seed:google-ai-plus-2026-11-05:apply'], 'tsx scripts/seed-google-ai-plus-2026-11-05.ts --apply');
});
