/** Fixed reviewed predicates. Never parse/execute the psql check or export note data. */
import type { Sql } from 'postgres';
import { invariant } from './exact';
import { profile, identifier, qualified } from './structure';
export const PUBLIC_URLS = [
  'https://openai.com', 'https://openai.com/',
  'https://openai.com/index/introducing-o3-and-o4-mini/', 'https://openai.com/index/introducing-o3-and-o4-mini',
  'https://platform.openai.com', 'https://platform.openai.com/', 'https://platform.openai.com/docs/models/o3',
  'https://developers.openai.com', 'https://developers.openai.com/',
  'https://developers.openai.com/api/docs/models/o3', 'https://developers.openai.com/api/docs/models/o3/',
  'https://openrouter.ai/openai/o3', 'https://openrouter.ai/openai/o3:batch',
] as const;
/** Run after structural/type checks, before fetching any public beforeimages.
 * Return booleans only; an invalid field never enters a manifest or digest. */
export async function publicGates(tx: Sql, moved: boolean) {
  const ids = moved ? [3192] : [3014, 3192];
  const allowedUrls = [...PUBLIC_URLS];
  const [identity] = await tx`SELECT count(*)=${ids.length} AND bool_and(coalesce(
    (id=3014 AND name='o3-(batch)' AND slug='o3-(batch)' OR id=3192 AND name='o3-batch' AND slug='openai-o3-batch')
    AND type='llm' AND context_window=200000 AND model_category='text' AND pricing_unit='per_1m_tokens',false)) AS ok
    FROM public.models WHERE id=ANY(${ids}::integer[])`;
  invariant(identity.ok, 'Public identity/SKU gate refused');
  const [urls] = await tx`SELECT count(*)=${ids.length} AND bool_and(
    (offical_link IS NULL OR offical_link=ANY(${allowedUrls}::text[]))
    AND (license_url IS NULL OR license_url=ANY(${allowedUrls}::text[]))
    AND (deprecation_source_url IS NULL OR deprecation_source_url=ANY(${allowedUrls}::text[]))) AS ok
    FROM public.models WHERE id=ANY(${ids}::integer[])`;
  invariant(urls.ok, 'Public URL gate refused');
  for (const table of ['models', 'api_channel_prices']) {
    const cols = profile.columns.filter(c => c.table === table && ['timestamp with time zone', 'date'].includes(c.type));
    const where = table === 'models' ? 'id IN (' + ids.join(',') + ')' : 'id IN (15031,15334)';
    const [r] = await tx.unsafe('SELECT coalesce(bool_and(' + cols.map(c => '(' + identifier(c.name) + ' IS NULL OR (isfinite('
      + identifier(c.name) + ') AND extract(year FROM ' + identifier(c.name) + ') BETWEEN 1 AND 9999))').join(' AND ')
      + '),false) AS ok FROM ' + qualified(table) + ' WHERE ' + where);
    invariant(r.ok, 'Unsupported finite AD timestamp/date range: ' + table);
  }
  // Match fresh SQL: every scoped row has known kind/numeric version. Current
  // canonical rows additionally require exact plan/window/mix and numeric source.
  const [q] = await tx`WITH scoped AS (
    SELECT is_current,served_model,plan_id,plan_slug,"window",usage_mix_id,
      CASE WHEN notes IS JSON OBJECT THEN notes::jsonb ELSE NULL END AS note
    FROM public.quota_estimates WHERE served_model IN ('o3-(batch)','openai-o3-batch')
  ), checked AS (
    SELECT *,coalesce(note->>'kind'='payg-list-price' AND note->'version'='1'::jsonb,false) AS known_kind,
      coalesce(note #> '{source,api_channel_price_id}'='15334'::jsonb,false) AS source15334 FROM scoped
  ) SELECT coalesce(bool_and(known_kind),false)
    AND count(*) FILTER(WHERE served_model='o3-(batch)')=0
    AND count(*) FILTER(WHERE served_model='openai-o3-batch' AND is_current)=2
    AND count(DISTINCT usage_mix_id) FILTER(WHERE served_model='openai-o3-batch' AND is_current)=2
    AND coalesce(bool_and(coalesce(plan_id IS NULL AND plan_slug='payg:openrouter' AND "window"='monthly'
      AND usage_mix_id IN ('coding-high-cache','chat') AND source15334 AND known_kind,false))
      FILTER(WHERE served_model='openai-o3-batch' AND is_current),false) AS ok FROM checked`;
  invariant(q.ok, 'Quota precondition conflict: require known kind/version and oldlabel0/canonical2 numeric channel15334');
}
