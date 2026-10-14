#!/usr/bin/env tsx
/**
 * Preview NULL-only link backfills (default): npm run seed:provider-links
 * Apply deliberately: npm run seed:provider-links -- --apply
 * Run the console_url migration first. Requires an explicitly configured DB.
 */
import { config } from 'dotenv';
import postgres from 'postgres';
import { PROVIDER_LINK_FIELDS, PROVIDER_LINK_SEEDS, missingProviderLinks, type ProviderLinkField } from './data/provider-links';

config({ path: '.env.local', quiet: true });
const APPLY = process.argv.includes('--apply') && !process.argv.includes('--dry-run');
const COLUMNS: Record<ProviderLinkField, string> = {
  website: 'website', apiDocsUrl: 'api_docs_url', pricingUrl: 'pricing_url', consoleUrl: 'console_url',
};
type ProviderRow = Record<ProviderLinkField, string | null> & { id: number; slug: string };

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required; no implicit database connection is used.');
  const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 5 });
  try {
    console.log(`seed-provider-links [${APPLY ? 'APPLY' : 'DRY-RUN'}]`);
    await sql.begin(async transaction => {
      // postgres@3's TransactionSql uses Omit, which drops its callable signatures.
      const tx = transaction as unknown as typeof sql;
      if (!APPLY) await tx`SET TRANSACTION READ ONLY`;
      const providers = await tx<ProviderRow[]>`
        SELECT id, slug, website, api_docs_url AS "apiDocsUrl", pricing_url AS "pricingUrl", console_url AS "consoleUrl"
        FROM providers WHERE slug IN ${tx(Object.keys(PROVIDER_LINK_SEEDS))} ORDER BY slug
      `;
      for (const provider of providers) {
        const diff = missingProviderLinks(provider, PROVIDER_LINK_SEEDS[provider.slug]);
        for (const field of PROVIDER_LINK_FIELDS) {
          const value = diff[field];
          if (!value) continue;
          console.log(`${provider.slug}.${field}: NULL -> ${value}`);
          if (APPLY) {
            // Recheck NULL at write time so a concurrent update is never overwritten.
            await tx`UPDATE providers SET ${tx(COLUMNS[field])} = ${value}
              WHERE id = ${provider.id} AND ${tx(COLUMNS[field])} IS NULL`;
          }
        }
      }
      const seen = new Set(providers.map(provider => provider.slug));
      for (const slug of Object.keys(PROVIDER_LINK_SEEDS)) {
        if (!seen.has(slug)) console.log(`${slug}: absent, skipped`);
      }
      if (!APPLY) console.log('No writes. Pass --apply to fill NULL fields.');
    });
  } finally {
    await sql.end();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
