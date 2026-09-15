#!/usr/bin/env tsx
/**
 * Seed stable logo URLs for providers introduced by the multimodal verticals.
 */
import { db } from './db/queries';
import { VERTICAL_PROVIDER_LOGOS } from '../src/lib/vertical-provider-logos';

const APPLY = process.argv.includes('--apply');

interface ProviderRow {
  id: number;
  slug: string;
  name: string;
  logo_url: string | null;
}

async function main() {
  const slugs = Object.keys(VERTICAL_PROVIDER_LOGOS);
  const { data, error } = await db.from('providers').select('id, slug, name, logo_url').in('slug', slugs);
  if (error) throw error;

  const providers = (data ?? []) as ProviderRow[];
  const seen = new Set(providers.map((provider) => provider.slug));
  let updated = 0;
  let skipped = 0;

  console.log(`\n🖼 seed-vertical-provider-logos ${APPLY ? '[APPLY]' : '[DRY-RUN]'} (${providers.length}/${slugs.length} providers found)\n`);

  for (const provider of providers) {
    const logoUrl = VERTICAL_PROVIDER_LOGOS[provider.slug];
    if (!logoUrl) continue;
    if (provider.logo_url) {
      console.log(`  ✓ ${provider.slug}: existing logo_url kept`);
      skipped++;
      continue;
    }
    console.log(`  ↻ ${provider.slug}: no logo_url → ${logoUrl}`);
    if (APPLY) {
      const { error: updateError } = await db
        .from('providers')
        .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
        .eq('id', provider.id);
      if (updateError) throw updateError;
    }
    updated++;
  }

  for (const slug of slugs) {
    if (!seen.has(slug)) console.log(`  ⚠ ${slug}: provider not present yet`);
  }

  console.log('\n━━━ Summary ━━━');
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  if (!APPLY) console.log('Dry-run only. Re-run with --apply or npm run seed:vertical-logos to write.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
