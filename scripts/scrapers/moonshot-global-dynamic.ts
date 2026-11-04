/**
 * Kimi international (moonshot-global) token pricing from platform.kimi.ai.
 *
 * Until 2026-11-04 nothing scraped this page: the six moonshot-global rows were
 * only ever written by the 2026-11-02 catalog seed, so their last_verified could
 * never move and SRE's daily check flagged them as stale. Same Mintlify DocTable
 * payload as the China page (moonshot-dynamic), but USD and English headings.
 */
import type { ScrapedPrice, ScrapedPriceVariant, ScraperResult } from '../utils/validator';
import { runScraperCli } from './lib/cli-exit';
import {
  extractKimiTablesFromHtml, fetchKimiHtml, parseKimiModelIds, parseKimiPricingTables, readKimiPrice,
  type KimiPricingTable, type StaticFetchOptions,
} from './moonshot-dynamic';
import { normalizeModelName } from '../utils/validator';

export const KIMI_GLOBAL_PRICING_PAGE = 'https://platform.kimi.ai/docs/pricing/chat';
export const KIMI_GLOBAL_SOURCE = 'Moonshot Global';

const CACHE_WRITE_COLUMNS = [
  { ttl: '5m', seconds: 300, header: /^5\s*m(in)?\s+writes?$/i },
  { ttl: '1h', seconds: 3600, header: /^1\s*h(our)?\s+writes?$/i },
] as const;

/**
 * Headline prices plus, for rows that publish cache-write TTL columns, the
 * `standard` headline variant and `cache-write-5m/1h` detail variants (same
 * keys/shape as the 2026-11-02/03 seeds, so the scrape refreshes those rows
 * instead of creating parallel ones). Any malformed cell fails the whole parse.
 */
export function parseKimiGlobalPricingTables(tables: KimiPricingTable[], sourceUrl = KIMI_GLOBAL_PRICING_PAGE): { prices: ScrapedPrice[]; variants: ScrapedPriceVariant[] } {
  const prices: ScrapedPrice[] = parseKimiPricingTables(tables, 'global').map(price => ({
    modelName: price.modelName, modelSlug: price.modelName,
    inputPricePer1M: price.inputPricePer1M!, outputPricePer1M: price.outputPricePer1M!,
    cachedInputPricePer1M: price.cachedInputPricePer1M, contextWindow: price.contextWindow ?? undefined,
    isAvailable: true, currency: 'USD',
  }));
  const writeNotes = new Map<string, string>();
  const variants: ScrapedPriceVariant[] = [];
  for (const table of tables) {
    const headers = table.headers.map(value => value.trim());
    const modelIndex = headers.findIndex(value => /^model$/i.test(value));
    const writes = CACHE_WRITE_COLUMNS.map(column => ({ ...column, index: headers.findIndex(value => column.header.test(value)) }));
    const present = writes.filter(column => column.index >= 0);
    if (present.length === 0) continue;
    if (present.length !== writes.length) throw new Error('Kimi international table has only some cache-write columns');
    for (const cells of table.rows) {
      const modelName = normalizeModelName(parseKimiModelIds(cells[modelIndex] ?? '')[0]).toLowerCase();
      const price = prices.find(item => item.modelName === modelName)!;
      const base = {
        modelName, modelSlug: modelName, sourceUrl, currency: 'USD' as const, priceUnit: 'per_1m_tokens',
        inputPricePer1M: price.inputPricePer1M, outputPricePer1M: price.outputPricePer1M,
        cachedInputPricePer1M: price.cachedInputPricePer1M, isAvailable: true,
        isPublic: true, isSelfService: true, isPartnerOnly: false,
      };
      variants.push({ ...base, variantKey: 'standard', variantName: 'Standard', variantKind: 'tier',
        isHeadline: true, headlineRank: 0, constraints: { speed: 'standard' },
        headlineReason: 'Official Kimi international list price (input/output/cache-hit).' });
      const notes: string[] = [];
      for (const column of writes) {
        const write = readKimiPrice(cells[column.index], 'global', `${modelName}: ${headers[column.index]}`);
        if (write < price.inputPricePer1M) throw new Error(`Inconsistent Kimi cache-write price: ${modelName}`);
        notes.push(`${column.ttl} TTL $${write}/1M tokens`);
        variants.push({ ...base, variantKey: `cache-write-${column.ttl}`, variantName: `Cache write (${column.ttl} TTL)`,
          variantKind: 'other', cacheCreatePricePer1M: write, isHeadline: false,
          constraints: { cache_ttl_seconds: column.seconds } });
      }
      writeNotes.set(modelName, `Cache write: ${notes.join('; ')}. `);
    }
  }
  return { prices: prices.map(price => ({ ...price,
    notes: `Official Kimi international API ${price.modelName}: input/output/cache-hit USD per 1M tokens. ${writeNotes.get(price.modelName) ?? ''}Source: ${sourceUrl}.` })), variants };
}

export async function scrapeMoonshotGlobalDynamic(options: StaticFetchOptions = {}): Promise<ScraperResult> {
  const html = await fetchKimiHtml(KIMI_GLOBAL_PRICING_PAGE, 'en-US,en;q=0.9', options);
  const { prices, variants } = parseKimiGlobalPricingTables(extractKimiTablesFromHtml(html));
  console.log(`${KIMI_GLOBAL_SOURCE}: ${prices.length} prices, ${variants?.length ?? 0} variants from server-rendered HTML`);
  return {
    source: KIMI_GLOBAL_SOURCE, success: true, prices, variants,
    metadata: { isRealTime: true, confidence: 'high', sourceUrl: KIMI_GLOBAL_PRICING_PAGE, lastVerified: new Date() },
  };
}

if (require.main === module) {
  void runScraperCli(() => scrapeMoonshotGlobalDynamic(), result => console.log(JSON.stringify(result, null, 2)));
}
