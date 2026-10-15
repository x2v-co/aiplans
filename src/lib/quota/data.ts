import { cache } from 'react';
import { readVerifiedQuotaEstimates, type QuotaEstimateRow } from './estimates';

/** No DB client is imported by arithmetic, rendering or offline tests. */
export const getVerifiedQuotaEstimates = cache(async (planSlugs?: string[]) => {
  if (planSlugs?.length === 0) return [];
  return readVerifiedQuotaEstimates(async () => {
    const { sql, TEXT_ARRAY } = await import('../db');
    return [...await sql<QuotaEstimateRow[]>`
      SELECT qe.id, qe.plan_slug, p.name AS plan_name, provider.name AS provider_name,
        qe.served_model, qe."window", qe.est_tokens_low::text, qe.est_tokens_high::text,
        qe.usage_mix_id, mix.name AS mix_name, mix.cache_read_pct::text,
        mix.input_pct::text, mix.output_pct::text, qe.confidence, qe.verified_at,
        qe.created_at, qe.notes, qe.is_current, qe.superseded_by,
        COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'id', evidence.id, 'url', evidence.url, 'screenshot_url', evidence.screenshot_url,
          'captured_at', evidence.captured_at::text, 'evidence_type', evidence.evidence_type
        ) ORDER BY evidence.captured_at, evidence.id)
          FROM quota_evidence evidence WHERE evidence.quota_estimate_id = qe.id), '[]'::jsonb) AS evidence
      FROM quota_estimates qe
      JOIN usage_mixes mix ON mix.id = qe.usage_mix_id
      LEFT JOIN plans p ON p.slug = qe.plan_slug
      LEFT JOIN providers provider ON provider.id = p.provider_id
      WHERE qe.verified_at IS NOT NULL
        AND (${planSlugs === undefined} OR qe.plan_slug = ANY(${sql.array(planSlugs ?? [], TEXT_ARRAY)}))
      ORDER BY qe.created_at DESC, qe.id DESC
    `];
  });
});
