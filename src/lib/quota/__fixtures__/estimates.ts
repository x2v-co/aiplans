import { verifiedEstimate, type QuotaEstimateRow } from '../estimates';

/** Synthetic values only; never a vendor allowance. */
export function estimateRow(overrides: Partial<QuotaEstimateRow> = {}): QuotaEstimateRow {
  return {
    id: 1, plan_slug: 'example-pro', plan_name: 'Example Pro', provider_name: 'Example vendor',
    served_model: 'example-model', window: 'weekly', est_tokens_low: '1234567', est_tokens_high: '2345678',
    usage_mix_id: 'chat', mix_name: 'Chat assumption', cache_read_pct: '0', input_pct: '75', output_pct: '25',
    confidence: 'medium', verified_at: '2026-10-01T08:00:00Z', created_at: '2026-10-01T09:00:00Z',
    notes: null, is_current: true, superseded_by: null,
    evidence: [{ id: 7, url: 'https://example.com/evidence', screenshot_url: 'https://example.com/screenshot.png', captured_at: '2026-09-30', evidence_type: 'self_measured' }],
    ...overrides,
  };
}

export function estimate(overrides: Partial<QuotaEstimateRow> = {}) {
  const value = verifiedEstimate(estimateRow(overrides));
  if (!value) throw new Error('Invalid synthetic fixture');
  return value;
}
