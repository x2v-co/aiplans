import { timingSafeEqual } from 'node:crypto';

/** Enable only in a separate management deployment, behind its own gateway. */
export function authorizeExchangeRateAdmin(request: Request, env: Readonly<Record<string, string | undefined>> = process.env): Response | null {
  const headers = { 'Cache-Control': 'no-store' };
  if (env.PLANPRICE_SERVICE_ROLE !== 'admin' || !env.PLANPRICE_ADMIN_HOST ||
      request.headers.get('host') !== env.PLANPRICE_ADMIN_HOST) {
    return Response.json({ error: 'Not found' }, { status: 404, headers });
  }
  const key = env.EXCHANGE_RATE_API_KEY;
  // Refuse missing, historical demo, and shared read credentials.
  if (!key || key.length < 32 || key === 'demo-update-key' || key === env.PLANPRICE_CATALOG_TOKEN) {
    return Response.json({ error: 'Management authentication unavailable' }, { status: 503, headers });
  }
  const actual = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${key}`);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return Response.json({ error: 'Unauthorized' }, {
      status: 401, headers: { ...headers, 'WWW-Authenticate': 'Bearer' },
    });
  }
  return null;
}
