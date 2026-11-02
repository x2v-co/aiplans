#!/usr/bin/env tsx
/** Intel P0-1/P1-1..P1-3. Offline preview by default; optional manual apply only.
 * DO NOT RE-RUN --apply: already applied 2026-11-02 and the scraper has since refreshed the
 * OpenRouter rows (a re-run rolls their last_verified/notes back). For the Kimi K3.1 Pro
 * standard headline use `npm run seed:catalog-2026-11-03-kimi-headline` instead.
 */
import {
  HAILUO, KIMI_CHANNELS, WORLD_SLUG, catalog20261102SeedOptions, kimiChannel, kimiCacheWriteVariants,
  openRouterChannel, seedCatalog20261102,
} from './data/catalog-2026-11-02';

const { apply } = catalog20261102SeedOptions(process.argv.slice(2));
async function main() {
  if (!apply) {
    console.log(JSON.stringify({ mode: 'DRY-RUN (offline; no database connection)',
      openrouter: openRouterChannel(-1, -1), kimi: KIMI_CHANNELS.map(spec => ({ aliases: spec.slugs, ...kimiChannel(spec, -1, -1) })),
      cacheWrite: { model: 'kimi-k3.1-pro', variants: kimiCacheWriteVariants(-1, -1) },
      hailuo: HAILUO, disableHailuoLegacyRates: ['credit', 'generation', 'availability', 'video_second', 'H3-Max'],
      modelUnits: { [WORLD_SLUG]: 'per_1m_tokens', 'hailuo-video': 'per_second' },
    }, null, 2));
    console.log('Preview only. --apply resolves existing identities, validates the entire scope, and writes changed rows atomically.');
    return;
  }
  const { databaseSql: sql } = await import('./db/postgres-admin');
  try {
    const steps = await sql.begin('isolation level serializable', rawTx => seedCatalog20261102(rawTx as unknown as typeof sql, true));
    console.log(JSON.stringify(steps, null, 2));
    console.log(`Applied: ${steps.length} changes.`);
  } finally { await sql.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
