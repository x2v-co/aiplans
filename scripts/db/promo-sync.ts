import { databaseSql as sql } from './postgres-admin';
import { auditedPromoSources, planPromoSync, promoModelKey, type PromoChannel, type PromoChange } from '../utils/promo-sync';

/** Called after all providers finish, so completion order cannot erase propagation. */
export async function syncResellerPromos(apply = false, repair = false): Promise<number> {
  return sql.begin('isolation level serializable', async rawTx => {
    const tx = rawTx as unknown as typeof sql;
    if (!apply) await tx`SET TRANSACTION READ ONLY`;
    const rows = await tx<PromoChannel[]>`
      SELECT cp.*, m.slug AS model_slug, p.slug AS provider_slug, p.type AS provider_type
      FROM api_channel_prices cp JOIN models m ON m.id = cp.model_id JOIN providers p ON p.id = cp.provider_id
      WHERE m.slug ~ '^(google(-gemini)?-)?gemini-(4-argon|3[.-][68]-flash)$'`;
    const sources = repair ? auditedPromoSources(rows) : rows;
    const changes: PromoChange[] = planPromoSync(sources);
    if (repair) {
      for (const key of ['gemini-4-argon', 'gemini-3.6-flash', 'gemini-3.8-flash']) {
        const official = sources.filter(row => promoModelKey(row.model_slug) === key && row.provider_slug === 'google'
          && ['official', 'producer'].includes(row.provider_type ?? '')
          && row.currency === 'USD' && row.price_unit === 'per_1m_tokens');
        if (official.length !== 1 || official[0].input_price_per_1m == null || !Number.isFinite(official[0].input_price_per_1m) || official[0].input_price_per_1m <= 0
          || official[0].output_price_per_1m == null || !Number.isFinite(official[0].output_price_per_1m) || official[0].output_price_per_1m < official[0].input_price_per_1m) {
          throw new Error(`Expected one priced standard Google row for ${key}; nothing written. Missing/unknown source prices need verification.`);
        }
        const source = official[0];
        const old = rows.find(row => row.id === source.id)!;
        const values = { promo_ends_at: source.promo_ends_at, regular_input_price_per_1m: source.regular_input_price_per_1m,
          regular_output_price_per_1m: source.regular_output_price_per_1m, notes: source.notes ?? '' };
        if (new Date(old.promo_ends_at ?? '').getTime() !== new Date(source.promo_ends_at!).getTime()
          || old.regular_input_price_per_1m !== source.regular_input_price_per_1m
          || old.regular_output_price_per_1m !== source.regular_output_price_per_1m) {
          changes.push({ id: source.id, target: `google/${key}`, values });
        }
      }
    }
    console.log(`Promo sync ${apply ? '[APPLY]' : '[DRY-RUN]'}: ${changes.length} changes`);
    if (changes.length) console.log(JSON.stringify(changes.map(change => ({ ...change,
      before: rows.find(row => row.id === change.id) })), null, 2));
    if (apply) for (const change of changes) {
      const values = { ...change.values, updated_at: new Date() };
      const keys = Object.keys(values) as Array<keyof typeof values>;
      await tx`UPDATE api_channel_prices SET ${tx(values, ...keys)} WHERE id = ${change.id}`;
    }
    return changes.length;
  });
}
