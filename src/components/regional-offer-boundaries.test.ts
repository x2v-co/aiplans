// Static boundaries plus an injected, DB-free query check. No DB clients, servers or builds.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadQueryModule } from '@/lib/test-helpers/query-module';
import { syntheticOffer } from '@/lib/price-offers/synthetic-fixture';
import type { OfferReader } from '@/lib/price-offers/read';

// Two pre-373 guards are deliberately rebound: unchanged deployed provider wrapper
// and composed model query. Paired semantic tests below preserve cache and both paths.
const protectedHashes: Record<string, string> = {
  "drizzle/0017_plan_promotions.sql": "125c626513a8f4cdefdbebdbd7442dfdbb9af6591fe77b138ae96c6c8686892c",
  "scripts/migrate-data-accuracy.ts": "99b45df718845a391be308ddfaf5153ea374d6921108d5756e5d2b3e7c37a156",
  "src/app/[locale]/api-pricing/page.tsx": "88d2cfca93ed10324fabe673b82469c126ee61d69297599d64b829e3865e0f8c",
  "src/app/[locale]/filtered/plans/page.tsx": "bf631dddbdbf8bac2f8c2b99dccc27545abe0068b897e62c7b2a16913b1a4507",
  "src/app/[locale]/models/page.tsx": "67cd522f2778a8e290525045bdc393288933174297391f2b4214bc36734a810c",
  "src/app/[locale]/plans/catalog-page.tsx": "f150be8d2cd229cb22640e36e94a5e8efdfd89d4e8203db9c7b42d8e664e7b29",
  "src/app/[locale]/plans/page.tsx": "3e62f64a436d9c0f771b151b4dcf494b84de30494349b6f3058793f6a1a1f479",
  "src/components/limited-time-offer.tsx": "1d5f3d68dfc9b16b43b8e8dd3906bea4b99a414b2dd005e55c4d1a9779537ea4",
  "src/components/model-plan-card.test.ts": "a2e4da1a16da2e02d5b0b95eb5fa73b0410c75c0df3b645d5a8259e48c42ad86",
  "src/components/model-pricing-summary.test.ts": "9e5e78069682b6490d51374f6a0958c84473ef715618ee9f1285397af5ead406",
  "src/components/model-pricing-summary.tsx": "2757564e8cbc5f0838ec8dffe1cf745d0592dc95f29d11cd21b1079f2859a528",
  "src/components/plan-limited-time-offer.tsx": "356fe1e729594e590121a75a71247187cd54276f86417e6508b0c1a2e8cc6a79",
  "src/lib/catalog-query-routes.ts": "b952147eb004cb095a8a32dbfc3b7b84f132c38ddcbfc71c8e2e83df3646aff3",
  "src/lib/limited-time-offer.test.ts": "fd621a605e291084510feb6154376d2acee1de13745493dff0bff661058e8c67",
  "src/lib/limited-time-offer.ts": "75c02c7c360ba687bfe08e0352ec662f3b8262c9366cf2535df321230715d1d3",
  "src/lib/plan-limited-time-offer.test.ts": "d466b4da52b659f763290a5486d2b82cba5653c6c2410be34c174cc148946618",
  "src/lib/plan-limited-time-offer.ts": "196bdf34fd7192de88a40558aff9b34e7a50282568d19efa34adbe9b7567093b",
  "src/lib/plan-offers-query.ts": "bf766519a9d3ffdfd363902861f9f277e260d34fd03d6bfc9be80a7dfabcd1c5",
  "src/lib/plan-offers-route.test.ts": "3628bd662e87805616f5cef34abda58c71ccc76310800031fe9765483b480518",
  "src/lib/provider-page.ts": "98a0734fd2895d6d02ec9a406544426760e828565d7311012f79e8b80496ab11",

  "next.config.ts": "b1ca46de245c2ba124ca8939d43d4c951c1d0f43083d03bd3c6e97282c62526a",
  "src/app/[locale]/providers/[slug]/page.tsx": "1f0397d9887b8d77525532c3464865303e1d11eaeba2431f56c333be8533e32a",
  "src/lib/provider-plans-query.ts": "dd866608cda3f642c27d56cc7ccede955b0ca73d9606975f765903b08f36fe22",
  "src/lib/model-plans-query.ts": "94b0db1d6c7d53b449ec6e05ff667072e2b4b7651656facf0ab54189822ef756",
  "src/lib/price-offers/contract.ts": "bcd3159c59b2bd8852464cfa7deb8b2941ab4370c71a008e8b0cca76441f8b6e",
  "src/lib/price-offers/compare.ts": "a44329c636d72eb5e135a93f0a96a576641a987c2fb4b4b404709cd1314aab6b",
  "src/lib/price-offers/read.ts": "abb543752b3d867fb55e68adf9f48859a5bff8bb40c9bf5dd4e27f817022d3d0",
  "src/lib/price-offers/postgres.ts": "4353a21d04f7caddd085c2d28cd9fb064d114f29441ebcba13e4eb2d08388065",
  "src/lib/price-offers/writer.ts": "cab3a7666dfff1a141b92f1547352d764ae18326c0c3dda3a911b4ad6f745ffb",
  "package.json": "51a3a67fdcc4b13a6413684c1252f3fe7e0f5f4b649dde67cfc9bdbcfb9831f1",
  "package-lock.json": "9a16d112adbeba2b5b76eeaae1b9d5105b7f923abed6935d6bf45f1ec6c3eb54"
};
test('deployed cache/mobile/promotion sources, immutable PR1 modules and integrated loader remain hash-pinned', () => {
  for (const [path, expected] of Object.entries(protectedHashes))
    assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'), expected, path);
});
test('model route retains cache and lazy static generation; only existing bounded plan lookup opts into offers', () => {
  const source = readFileSync('src/app/[locale]/models/[slug]/page.tsx', 'utf8');
  assert.match(source, /export const revalidate = 300;/);
  assert.match(source, /export function generateStaticParams\(\) \{\s*return \[\];/);
  assert.match(source, /usagePrices\.flatMap[\s\S]*?now, \{ includePriceOffers: true \}/);
  assert.doesNotMatch(source, /force-dynamic|revalidate = 0|curation\/|minimax-candidates|synthetic-fixture/);
});
test('both new runtime modules are pure: no DB, PR2 candidates, archive, source fixtures or network imports', () => {
  for (const path of ['src/lib/price-offers/presentation.ts', 'src/components/regional-offer-prices.tsx']) {
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /from ['"][^'"]*(?:curation|synthetic|postgres|lib\/db|archive)|fetch\(|https?\.get|XMLHttpRequest/);
  }
});
test('bilingual regional offer message keys match and preserve all historical namespaces', () => {
  const en = JSON.parse(readFileSync('messages/en.json', 'utf8'));
  const zh = JSON.parse(readFileSync('messages/zh.json', 'utf8'));
  const leaves = (value: Record<string, unknown>, prefix = ''): string[] => Object.entries(value).flatMap(([k, v]) =>
    typeof v === 'object' ? leaves(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`]).sort();
  assert.deepEqual(leaves(en.regionalOffers), leaves(zh.regionalOffers));
  assert.ok(leaves(en.regionalOffers).length > 90);
});

test('deployed provider wrapper keeps ISR300, empty static params and query-free catalog delegation', () => {
  const source = readFileSync('src/app/[locale]/providers/[slug]/page.tsx', 'utf8');
  assert.match(source, /export const revalidate = 300;/);
  assert.match(source, /export function generateStaticParams\(\) \{\s*return \[\];/);
  assert.match(source, /const NO_QUERY = Promise.resolve\(\{\}\)/);
  assert.match(source, /CatalogPage\(\{ params, searchParams: NO_QUERY \}\)/);
  assert.doesNotMatch(source, /force-dynamic|force-no-store|lib\/db|curation|synthetic/);
});

test('integrated model query preserves promotion projection and bounded opt-in typed regional read', async () => {
  // Query/OfferReader boundary doubles only. They do not model postgres unsafe()/wire encoding.
  const rows = [{ id: 1, price: 77, currency: 'USD', pricing_model: 'subscription',
    regular_price: 99, regular_annual_price: 990, promo_ends_at: '2099-12-01T08:00:00Z', providers: { region: 'global' } },
  { id: 2, price: 88, currency: 'USD' }];
  let selected = rows, statement = '', factories = 0;
  const batches: number[][] = [];
  const reader: OfferReader = { async read(ids) {
    batches.push([...ids]); return { status: 'available', rows: [{ offer: syntheticOffer(), revision: 1 }] };
  } };
  const sql = Object.assign(async (strings: TemplateStringsArray) => {
    statement = strings.join('?'); return selected;
  }, { array: (values: unknown[]) => values });
  const { getModelPlans } = loadQueryModule(new URL('../lib/model-plans-query.ts', import.meta.url), {
    './db': { sql, INT4_ARRAY: 1007 },
    './price-offers/postgres': { createPostgresOfferReader: () => { factories++; return reader; } },
  }) as typeof import('@/lib/model-plans-query');
  const now = new Date('2026-11-17T00:00:00Z');
  const legacy = await getModelPlans(10, 8, [1], now);
  assert.deepEqual(Array.from(legacy), rows); assert.equal(factories, 0); assert.deepEqual(batches, []);
  const attached = await getModelPlans(10, 8, [1], now, { includePriceOffers: true });
  assert.deepEqual(batches, [[1, 2]]); assert.equal(factories, 1);
  assert.equal(attached[0].priceOffers?.[0].originalPrice.amount, '10.00');
  assert.equal(attached[1].priceOffers?.length, 0);
  for (const [key, value] of Object.entries(rows[0])) assert.deepEqual(attached[0][key as keyof typeof attached[0]], value);
  for (const column of ['promo_ends_at', 'regular_price', 'regular_annual_price'])
    assert.ok(statement.includes(`to_jsonb(pl)->>'${column}'`));
  assert.match(statement, /pl\.pricing_model/); assert.match(statement, /'region', p\.region/);
  assert.match(statement, /FROM model_plan_mapping/); assert.match(statement, /pl\.id = ANY/);
  assert.match(statement, /legacy_ends_on/); assert.match(statement, /superseded-by/);
  assert.doesNotMatch(statement, /\b(?:UPDATE|INSERT|DELETE)\b/);
  selected = [];
  assert.deepEqual(Array.from(await getModelPlans(10, 8, [], now, { includePriceOffers: true })), []);
  assert.deepEqual(batches, [[1, 2]], 'empty selected plans must not query offers');
  const schema = readFileSync('src/db/schema/index.ts', 'utf8');
  assert.match(schema, /promoEndsAt: timestamp\('promo_ends_at'/);
  assert.match(schema, /regularPrice: real\('regular_price'/);
  assert.match(schema, /regularAnnualPrice: real\('regular_annual_price'/);
  assert.match(schema, /export \* from '\.\/price-offers'/);
});
