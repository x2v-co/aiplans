export const QUOTA_UNITS = ['usd', 'requests', 'tokens', 'credits'] as const;
export type QuotaUnit = typeof QUOTA_UNITS[number];

/** Missing fields and NULL both mean unknown, including before migration. */
export interface ChannelTermsFields {
  data_for_discount?: boolean | null;
  data_for_discount_note?: string | null;
  quota_unit?: string | null;
}

export type ChannelTermBadge =
  | { kind: 'training'; note: string | null }
  | { kind: 'quota'; unit: QuotaUnit };

export function channelTermBadges(terms?: ChannelTermsFields | null): ChannelTermBadge[] {
  const badges: ChannelTermBadge[] = [];
  // Only an explicit true denotes training in exchange for a discount/quota.
  if (terms?.data_for_discount === true) {
    badges.push({ kind: 'training', note: terms.data_for_discount_note?.trim() || null });
  }
  const unit = QUOTA_UNITS.find(unit => unit === terms?.quota_unit);
  if (unit) badges.push({ kind: 'quota', unit });
  return badges;
}
