import {
  CITABLE_SCHEMA, PUBLIC_QUOTE_FIELDS, finalizeObservedQuotes, prepareQuotes, reobservePublicQuote, snapshotDigest, trustedPricingSource, toPublicQuote,
  type CitableSnapshot, type Observation, type PreparedQuotes, type PublicQuote, type RawChannelQuote, type Rejection,
} from './citable-price-facts';

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid radar input object');
  return value as Record<string, unknown>;
}

function time(value: unknown): string {
  if (typeof value !== 'string' || Number.isNaN(new Date(value).getTime())) throw new Error('invalid radar input timestamp');
  return value;
}

/** A quote checksum verifies saved quote bytes, not source authority or redistribution rights. */
export function loadRadarInput(value: unknown, comparisonAsOf: Date, maxAgeDays = 30): PreparedQuotes {
  if (Number.isNaN(comparisonAsOf.getTime())) throw new Error('invalid comparison clock');
  const input = object(value);
  const asOf = time(input.as_of);
  if (!('quotes' in input)) {
    if (!Array.isArray(input.rows)) throw new Error('radar input needs rows or a CitableSnapshot');
    const fixture = input.fixture === true;
    if (fixture && input.not_market_data !== true) throw new Error('fixture requires not_market_data:true');
    const prepared = prepareQuotes(input.rows as RawChannelQuote[], {
      allowFixture: fixture, asOf: comparisonAsOf, generatedAt: comparisonAsOf, maxAgeDays,
    });
    return { ...prepared, as_of: asOf };
  }

  if (input.schema !== CITABLE_SCHEMA || !Array.isArray(input.quotes)) throw new Error('invalid CitableSnapshot schema');
  if (!['synthetic_fixture', 'live_official_public_quotes', 'live_official'].includes(String(input.sample_kind))) throw new Error('invalid snapshot sample_kind');
  const redistribution = object(input.redistribution);
  if (redistribution.granted_license !== null || redistribution.cc0 !== false || redistribution.mit !== false) {
    throw new Error('snapshot cannot grant a redistribution license');
  }
  const fixture = input.sample_kind === 'synthetic_fixture';
  if (fixture && input.not_market_data !== true) throw new Error('synthetic snapshot requires not_market_data:true');
  // Validate enough of the quote schema before computing identities and the digest.
  const quotes = input.quotes.map((value): PublicQuote => {
    const quote = object(value);
    for (const field of PUBLIC_QUOTE_FIELDS) {
      const item = quote[field];
      if (field.endsWith('_missing') || ['zero_price', 'promo_active'].includes(field)) {
        if (typeof item !== 'boolean') throw new Error(`invalid snapshot quote ${field}`);
      } else if (field.endsWith('_price')) {
        if (item !== null && (typeof item !== 'number' || !Number.isFinite(item) || item < 0)) throw new Error(`invalid snapshot quote ${field}`);
      } else if (field === 'promo_ends_at' || field === 'shutdown_date') {
        if (item !== null) time(item);
      } else if (typeof item !== 'string') throw new Error(`invalid snapshot quote ${field}`);
    }
    return quote as unknown as PublicQuote;
  });
  if (input.snapshot_id !== snapshotDigest(quotes)) throw new Error('snapshot_id digest mismatch: tampered snapshot');
  const observations: Observation[] = [];
  const rejections: Rejection[] = [];
  for (const quote of quotes) {
    if (!['official', 'producer'].includes(quote.channel_role)) throw new Error('non_official_channel');
    if (!trustedPricingSource(quote.source_url, fixture)) throw new Error('invalid snapshot pricing source');
    // Legacy headline strings do not establish researched applicability.
    const scope = /^scope=(\{.*\});input=(quoted|missing);output=(quoted|missing);cache=(quoted|missing);promo=/.exec(quote.billing_conditions);
    if (!scope) throw new Error('snapshot scope_unestablished');
    const researched = object(JSON.parse(scope[1]));
    const constraints = object(researched.constraints);
    if (!Object.keys(constraints).length && !researched.channel_notes && !researched.variant_notes) throw new Error('snapshot scope_unestablished');
    const observed = reobservePublicQuote(quote, comparisonAsOf, { maxAgeDays, fixture });
    if (observed.rejection) rejections.push(observed.rejection);
    else if (observed.observation) observations.push(observed.observation);
  }
  const finalized = finalizeObservedQuotes(observations, rejections);
  const snapshot = input as unknown as CitableSnapshot;
  return {
    fixture, as_of: asOf, generated_at: time(input.generated_at), max_age_days: maxAgeDays,
    observations: finalized.kept,
    rejections: finalized.rejections,
    publishable: fixture ? finalized.kept.map(toPublicQuote).filter((quote): quote is PublicQuote => quote !== null) : [],
    excluded_counts: finalized.excludedCounts, duplicates_collapsed: finalized.duplicatesCollapsed, snapshot,
  };
}
