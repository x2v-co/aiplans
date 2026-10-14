/**
 * Rebrand provider slug=xai to SpaceXSI (formerly SpaceXAI / xAI).
 *
 * Sources (verified 2026-10-14):
 *   - https://x.ai  (official site: <title>SpaceXSI</title>, schema.org
 *     alternateName ["SpaceXAI","xAI","x.ai"], header wordmark aria-label SpaceXSI)
 *   - Reuters 2026-10-04: Musk says SpaceXAI will be renamed SpaceXSI
 *   - @SpaceXSI handle live since ~2026-10-10
 *
 * Touches only providers row slug='xai': name, logo_url, description.
 * The slug stays 'xai' so /plans/xai and every FK keep working.
 *
 *   npx tsx scripts/rebrand-xai-spacexsi.ts                         # dry-run (default)
 *   npx tsx scripts/rebrand-xai-spacexsi.ts --apply --backup=/path.json
 */
import fs from 'node:fs';
import { databaseSql as sql } from './db/postgres-admin';

const APPLY = process.argv.includes('--apply');
const BACKUP = process.argv.find((a) => a.startsWith('--backup='))?.slice(9)
  ?? `/tmp/aiplans-xai-rebrand-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

export const SPACEXSI_PROVIDER = {
  name: 'SpaceXSI',
  logoUrl: '/providers/spacexsi.svg',
  description: 'SpaceXSI (formerly xAI / SpaceXAI), the SpaceX AI unit behind Grok',
} as const;

type Row = { id: number; slug: string; name: string; logo: string | null; logo_url: string | null; description: string | null };

async function main() {
  console.log(`\n🔧 rebrand-xai-spacexsi ${APPLY ? '[APPLY]' : '[DRY-RUN]'}\n`);
  const rows = await sql<Row[]>`SELECT id, slug, name, logo, logo_url, description FROM providers WHERE slug = 'xai'`;
  if (rows.length !== 1) { console.error(`✗ expected 1 provider slug=xai, found ${rows.length}; nothing written`); process.exitCode = 1; return; }
  const r = rows[0];
  const t = SPACEXSI_PROVIDER;
  console.log(`  #${r.id} name:        ${r.name} -> ${t.name}`);
  console.log(`  #${r.id} logo_url:    ${r.logo_url ?? 'NULL'} -> ${t.logoUrl}`);
  console.log(`  #${r.id} description: ${r.description ?? 'NULL'} -> ${t.description}`);
  if (r.name === t.name && r.logo_url === t.logoUrl && r.description === t.description) { console.log('\n  already up to date'); return; }
  if (!APPLY) { console.log('\nDry-run only. Re-run with --apply --backup=<path> to write.'); return; }
  fs.writeFileSync(BACKUP, JSON.stringify({ at: new Date().toISOString(), providers: rows }, null, 2), { mode: 0o600 });
  console.log(`💾 backup: ${BACKUP}`);
  await sql`UPDATE providers SET name = ${t.name}, logo_url = ${t.logoUrl}, description = ${t.description}, updated_at = now() WHERE id = ${r.id} AND slug = 'xai'`;
  console.log('✓ applied');
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => sql.end());
