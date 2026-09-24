import { createHash } from 'node:crypto';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { sql } from '../src/lib/db';
import { canonicalJson } from '../src/lib/planprice-v1-snapshot';

type PriceRow = {
  channel_price_id: number;
  model_id: number;
  model_slug: string;
  model_name: string;
  model_context_window: number | null;
  model_capabilities: string[] | null;
  provider_id: number;
  provider_slug: string;
  provider_region: string | null;
  pricing_url: string | null;
  website: string | null;
  input_price_per_1m: number | string | null;
  output_price_per_1m: number | string | null;
  cached_input_price_per_1m: number | string | null;
  currency: string | null;
  is_available: boolean | null;
  last_verified: string | Date | null;
};

type FxRow = { to_currency: string; rate: number | string; source: string; valid_at: string | Date | null; updated_at: string | Date | null };

const now = new Date();
const generatedAt = now.toISOString();
const expiresAt = new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString();
const fxMaxAgeHours = Number(process.env.PLANPRICE_FX_MAX_AGE_HOURS ?? 30);
const snapshotPath = process.env.PLANPRICE_V1_SNAPSHOT_PATH ?? '/var/lib/planprice/snapshots/current.json';
const snapshotDir = process.env.PLANPRICE_V1_SNAPSHOT_DIR ?? snapshotPath.replace(/\/[^/]+$/, '');
const fxPath = process.env.PLANPRICE_V1_FX_PATH ?? `${snapshotDir}/exchange-rates.json`;

// Runtime capabilities are an explicit publication decision. The scraper's
// model taxonomy does not prove that a provider endpoint is suitable for an
// AEEIS agent run, so never infer `agent` from a generic LLM row. Production
// may extend this allowlist only after a real provider probe succeeds.
const runtimeAgentModels = new Set(
  (process.env.PLANPRICE_RUNTIME_AGENT_MODELS ?? 'gemini-2.5-flash')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);

function asString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value);
  if (!Number.isFinite(Number(text))) return null;
  if (/e/i.test(text)) return Number(text).toFixed(17).replace(/0+$/, '').replace(/\.$/, '');
  return text;
}

function decimalParts(value: string): { coefficient: bigint; scale: number } {
  const normalized = value.trim().replace(/^\+/, '');
  const [whole, fraction = ''] = normalized.split('.');
  return { coefficient: BigInt(`${whole || '0'}${fraction}`), scale: fraction.length };
}

function roundedDivide(value: string, divisor: string, scale = 8): string | null {
  try {
    const a = decimalParts(value);
    const b = decimalParts(divisor);
    if (b.coefficient <= 0n) return null;
    const numerator = a.coefficient * 10n ** BigInt(b.scale) * 10n ** BigInt(scale);
    const denominator = b.coefficient * 10n ** BigInt(a.scale);
    let quotient = numerator / denominator;
    const remainder = numerator % denominator;
    if (remainder * 2n > denominator || (remainder * 2n === denominator && quotient % 2n === 1n)) quotient += 1n;
    const unit = 10n ** BigInt(scale);
    const whole = quotient / unit;
    const fraction = quotient % unit;
    if (fraction === 0n) return whole.toString();
    return `${whole}.${fraction.toString().padStart(scale, '0').replace(/0+$/, '')}`;
  } catch {
    return null;
  }
}

function evidenceDigest(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`;
}

function sourceUrl(row: PriceRow): string {
  const candidate = row.pricing_url || row.website;
  return candidate && /^https:\/\//.test(candidate) ? candidate : 'https://aiplans.dev/';
}

function iso(value: string | Date | null): string {
  const date = value ? new Date(value) : now;
  return Number.isNaN(date.getTime()) ? now.toISOString() : date.toISOString();
}

function fresh(asOf: string): boolean {
  return Number.isFinite(fxMaxAgeHours) && fxMaxAgeHours > 0 && now.getTime() - Date.parse(asOf) <= fxMaxAgeHours * 3_600_000;
}

function stableId(prefix: string, value: string | number): string {
  return `${prefix}_${String(value).replace(/[^A-Za-z0-9._~-]/g, '_')}`;
}

async function main() {
const prices = await sql<PriceRow[]>`
  SELECT c.id AS channel_price_id, c.model_id, m.slug AS model_slug, m.name AS model_name,
         m.context_window AS model_context_window, m.capabilities AS model_capabilities,
         c.provider_id, p.slug AS provider_slug, p.region AS provider_region,
         p.pricing_url, p.website, c.input_price_per_1m, c.output_price_per_1m,
         c.cached_input_price_per_1m, c.currency, c.is_available, c.last_verified
  FROM api_channel_prices c
  JOIN models m ON m.id = c.model_id
  JOIN providers p ON p.id = c.provider_id
  WHERE c.is_available = true
  ORDER BY c.id
`;
const fxRows = await sql<FxRow[]>`
  SELECT DISTINCT ON (to_currency) to_currency, rate, source, valid_at, updated_at
  FROM exchange_rates
  WHERE is_active = true AND from_currency = 'USD'
  ORDER BY to_currency, updated_at DESC
`;

const fxByCurrency = new Map<string, FxRow>();
for (const row of fxRows) fxByCurrency.set(row.to_currency, row);

const quotes = fxRows.flatMap((row) => {
  const asOf = iso(row.valid_at ?? row.updated_at);
  const rate = asString(row.rate);
  if (!rate || !fresh(asOf) || Number(rate) <= 0) return [];
  return [{
    base: 'USD', quote: row.to_currency, rate, direction: 'quote_per_base', asOf,
    expiresAt: new Date(Date.parse(asOf) + fxMaxAgeHours * 3_600_000).toISOString(),
    sourceId: stableId('fx', row.source),
    evidenceDigest: evidenceDigest({ currency: row.to_currency, rate, source: row.source, asOf }),
  }];
});

const offerings = prices.map((row) => {
  const currency = (row.currency || 'USD').toUpperCase();
  const input = asString(row.input_price_per_1m);
  const output = asString(row.output_price_per_1m);
  const cached = asString(row.cached_input_price_per_1m);
  const fx = currency === 'USD'
    ? { base: 'USD', quote: 'USD', rate: '1', direction: 'quote_per_base', asOf: iso(row.last_verified), expiresAt, sourceId: 'identity', evidenceDigest: evidenceDigest({ currency: 'USD', asOf: iso(row.last_verified) }) }
    : (() => {
        const candidate = fxByCurrency.get(currency);
        const asOf = candidate ? iso(candidate.valid_at ?? candidate.updated_at) : '';
        const rate = candidate ? asString(candidate.rate) : null;
        if (!candidate || !rate || Number(rate) <= 0 || !fresh(asOf)) return null;
        return { base: 'USD', quote: currency, rate, direction: 'quote_per_base', asOf, expiresAt: new Date(Date.parse(asOf) + fxMaxAgeHours * 3_600_000).toISOString(), sourceId: stableId('fx', candidate.source), evidenceDigest: evidenceDigest({ currency, rate, source: candidate.source, asOf }) };
      })();
  const componentPrices = {
    input: input && fx ? (currency === 'USD' ? input : roundedDivide(input, fx.rate)) : null,
    output: output && fx ? (currency === 'USD' ? output : roundedDivide(output, fx.rate)) : null,
    ...(cached ? { cached_input: cached && fx ? (currency === 'USD' ? cached : roundedDivide(cached, fx.rate)) : null } : {}),
  };
  const normalizationAvailable = Boolean(input && output && fx && componentPrices.input && componentPrices.output);
  const observedAt = iso(row.last_verified);
  const source = sourceUrl(row);
  const capabilities = new Set(
    (row.model_capabilities || [])
      .map((value) => String(value).toLowerCase().replace(/[^a-z0-9_-]/g, '_'))
      .filter(Boolean),
  );
  if (runtimeAgentModels.has(String(row.model_slug).toLowerCase())) capabilities.add('agent');
  return {
    offeringId: stableId('offering', row.channel_price_id),
    modelId: stableId('model', row.model_slug || row.model_id),
    modelVersion: null,
    versionStatus: 'unknown',
    providerId: stableId('provider', row.provider_slug || row.provider_id),
    channelId: stableId('channel', row.provider_slug || row.provider_id),
    regionSetId: stableId('region', row.provider_region || 'global'),
    pricingVariantId: stableId('price', row.channel_price_id),
    regions: [String(row.provider_region || 'global').toLowerCase().replace(/[^a-z0-9_-]/g, '_')],
    capabilities: [...capabilities].sort(),
    contextWindow: row.model_context_window || null,
    catalogStatus: normalizationAvailable ? 'available' : 'degraded',
    runtimeStatus: 'unknown', runtimeObservedAt: null, runtimeEvidenceRef: null,
    pricing: {
      currency, effectiveAt: observedAt, expiresAt,
      components: [
        { componentId: 'input', kind: 'input', unit: 'token', currency, priceStatus: input ? 'known' : 'unknown', pricePerMillion: input, conditions: { schemaVersion: 'pricing-conditions/1', kind: 'standard' } },
        { componentId: 'output', kind: 'output', unit: 'token', currency, priceStatus: output ? 'known' : 'unknown', pricePerMillion: output, conditions: { schemaVersion: 'pricing-conditions/1', kind: 'standard' } },
        ...(cached ? [{ componentId: 'cached_input', kind: 'cached_input', unit: 'token', currency, priceStatus: 'known', pricePerMillion: cached, conditions: { schemaVersion: 'pricing-conditions/1', kind: 'standard' } }] : []),
      ],
      provenance: { sourceId: stableId('db', row.channel_price_id), sourceUrl: source, observedAt, evidenceDigest: evidenceDigest({ id: row.channel_price_id, source, observedAt, input, output, cached, currency }) },
      normalization: { status: normalizationAvailable ? 'available' : 'unavailable', currency: 'USD', componentPrices, fx, rounding: { scale: 8, mode: 'half_even', stage: 'converted_unit_price' } },
    },
  };
});

const payload = { schemaVersion: 'planprice-catalog/1', catalogVersion: `cat_${generatedAt.replace(/[^0-9]/g, '').slice(0, 14)}`, generatedAt, effectiveAt: generatedAt, expiresAt, baseCurrency: 'USD', offerings };
const snapshot = { ...payload, digest: `sha256:${createHash('sha256').update(canonicalJson(payload), 'utf8').digest('hex')}` };
const fxSnapshot = { schemaVersion: 'planprice-exchange-rates/1', base: 'USD', generatedAt, quotes };

await mkdir(snapshotDir, { recursive: true });
async function atomicWrite(path: string, value: unknown) {
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, path);
}
await atomicWrite(`${snapshotDir}/${payload.catalogVersion}.json`, snapshot);
await atomicWrite(snapshotPath, snapshot);
await atomicWrite(fxPath, fxSnapshot);
console.log(JSON.stringify({ schemaVersion: 'planprice-v1-publish/1', status: 'published', catalogVersion: payload.catalogVersion, digest: snapshot.digest, offerings: offerings.length, fxQuotes: quotes.length, expiresAt }, null, 2));
await sql.end({ timeout: 5 });
}

main().catch(async (error) => {
  console.error(`planprice-v1 publish failed: ${error instanceof Error ? error.message : String(error)}`);
  await sql.end({ timeout: 5 }).catch(() => undefined);
  process.exitCode = 1;
});
