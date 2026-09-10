#!/usr/bin/env tsx
/**
 * Seed the XiuRouter aggregator provider row.
 *
 * The nightly scrape pipeline (index-dynamic.ts) resolves channel rows by a
 * hardcoded provider id, so a new channel's provider must exist before its
 * scraper runs. Idempotent: matches on slug, updates metadata in place.
 *
 * Ground truth: https://github.com/x2v-co/aiplans/issues/3 (2026-09-04) and
 * manual verification of https://router.xiu.ai/api/pricing on 2026-09-10.
 *
 * Usage:
 *   npm run seed:xiurouter -- --dry-run
 *   npm run seed:xiurouter
 */
import { databaseSql } from './db/postgres-admin';

const DRY_RUN = process.argv.includes('--dry-run');

const PROVIDER = {
  name: 'XiuRouter',
  slug: 'xiurouter',
  type: 'aggregator',
  region: 'global',
  // USD-billed, .ai domain, no mainland-access evidence at submission time;
  // revisit if the operator confirms reachability / CN payment methods.
  access_from_china: false,
  website: 'https://router.xiu.ai/',
  pricing_url: 'https://router.xiu.ai/en/pricing',
  api_docs_url: 'https://docs.xiu.ai/router/',
  logo_url: '/providers/xiurouter.svg',
  currency: 'USD',
  priority: 2,
};

async function main() {
  console.log(`\n🌱 seed-xiurouter-provider ${DRY_RUN ? '[DRY-RUN]' : '[APPLY]'}\n`);

  const existing = await databaseSql<{ id: number }[]>`
    SELECT id FROM providers WHERE slug = ${PROVIDER.slug}
  `;

  if (existing.length > 0) {
    const id = existing[0].id;
    console.log(`  ℹ️  provider ${PROVIDER.slug} already exists as id=${id}, updating metadata`);
    if (!DRY_RUN) {
      await databaseSql`
        UPDATE providers SET
          name = ${PROVIDER.name},
          type = ${PROVIDER.type},
          region = ${PROVIDER.region},
          access_from_china = ${PROVIDER.access_from_china},
          website = ${PROVIDER.website},
          pricing_url = ${PROVIDER.pricing_url},
          api_docs_url = ${PROVIDER.api_docs_url},
          logo_url = ${PROVIDER.logo_url},
          currency = ${PROVIDER.currency},
          priority = ${PROVIDER.priority},
          updated_at = now()
        WHERE slug = ${PROVIDER.slug}
      `;
    }
    console.log(`  ✓ id=${id}`);
    return;
  }

  console.log(`  ➕ inserting provider ${PROVIDER.slug}`);
  if (DRY_RUN) {
    console.log('  (dry-run — no writes)');
    return;
  }

  const inserted = await databaseSql<{ id: number }[]>`
    INSERT INTO providers (
      name, slug, type, region, access_from_china,
      website, pricing_url, api_docs_url, logo_url, currency, priority
    ) VALUES (
      ${PROVIDER.name}, ${PROVIDER.slug}, ${PROVIDER.type}, ${PROVIDER.region},
      ${PROVIDER.access_from_china}, ${PROVIDER.website}, ${PROVIDER.pricing_url},
      ${PROVIDER.api_docs_url}, ${PROVIDER.logo_url}, ${PROVIDER.currency}, ${PROVIDER.priority}
    )
    RETURNING id
  `;
  console.log(`  ✓ created provider ${PROVIDER.slug} with id=${inserted[0].id}`);
  console.log('  → add this id to PROVIDER_IDS in scripts/index-dynamic.ts');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('💥 seed failed:', error);
    process.exit(1);
  });
