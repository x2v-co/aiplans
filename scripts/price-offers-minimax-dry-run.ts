/** Offline report only. Deliberately has no DB URL, client, apply mode or manual approval. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import bundle from '../src/lib/price-offers/curation/minimax-candidates.json';
import { dryRunMinimax } from '../src/lib/price-offers/curation/minimax';

if (process.argv.slice(2).some(arg => arg !== '--dry-run')) {
  throw new Error('Only --dry-run is supported. No apply, DB, network or external input options.');
}
const paths = ['scripts/scrapers/fixtures/minimax-mplan-offer-cn.md', 'scripts/scrapers/fixtures/minimax-mplan-offer-global.md'];
const assets = Object.fromEntries(paths.map(path => [path, readFileSync(resolve(__dirname, '..', path), 'utf8')]));
console.log(JSON.stringify(dryRunMinimax(bundle, assets), null, 2));
