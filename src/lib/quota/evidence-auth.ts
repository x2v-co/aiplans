import { timingSafeEqual } from 'node:crypto';

export const QUOTA_EVIDENCE_COOKIE = 'quota_evidence_token';

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a); const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Internal review page auth (same rules as exchange-rate admin key).
 * Accepts `Authorization: Bearer <QUOTA_EVIDENCE_TOKEN>` or cookie `quota_evidence_token`.
 * Missing/weak/shared key or wrong credential => false (caller renders 404).
 */
export function isQuotaEvidenceAuthorized(
  authorization: string | null | undefined,
  cookie: string | null | undefined,
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  const key = env.QUOTA_EVIDENCE_TOKEN;
  if (!key || key.length < 32 || key === env.PLANPRICE_CATALOG_TOKEN || key === env.EXCHANGE_RATE_API_KEY) return false;
  if (authorization && safeEqual(authorization, `Bearer ${key}`)) return true;
  return Boolean(cookie && safeEqual(cookie, key));
}
