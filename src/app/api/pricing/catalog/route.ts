import { getApiPricingSeoData } from '@/lib/pricing-seo-data';
import { getActiveCouponMap } from '@/lib/coupons';
import { parseCatalogRequest } from '@/lib/api-pricing-query';
import { catalogPage, channelPage, variantPage } from '@/lib/api-pricing-catalog';
import { createPublicSnapshot } from '@/lib/api-pricing-snapshot';

export const dynamic = 'force-dynamic';
const MAX_RESPONSE_BYTES = 128_000;
const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };

// Exactly two process-local public slots shared by every query/locale/expansion.
// No stale-on-error. One in-flight load per slot; failed loads cool down for 1s.
const productsSnapshot = createPublicSnapshot(async () => (await getApiPricingSeoData()).products,
  { ttlMs: 30_000, maxBytes: 8 * 1024 * 1024, failureCooldownMs: 1_000 });
const couponsSnapshot = createPublicSnapshot(() => getActiveCouponMap('api'),
  { ttlMs: 30_000, maxBytes: 512 * 1024, failureCooldownMs: 1_000 });

export async function GET(request: Request) {
  let parsed;
  try { parsed = parseCatalogRequest(new URL(request.url).searchParams); }
  catch { return Response.json({ error: 'Invalid catalog query' }, { status: 400, headers }); }
  try {
    const products = await productsSnapshot();
    const { mode, query, slug, channelId } = parsed;
    if (mode !== 'list') {
      const product = products.find(p => p.slug === slug);
      if (!product || mode === 'variants' && !product.versions.some(cp => cp.id === channelId)) {
        return Response.json({ error: 'Catalog entry unavailable' }, { status: 404, headers });
      }
    }
    const coupons = mode === 'variants' ? {} : await couponsSnapshot();
    // Resolve clocks AFTER shared reads: cached schedules/coupons cannot freeze an expired offer.
    const now = new Date();
    const page = mode === 'list' ? catalogPage(products, query, now)
      : mode === 'channels' ? channelPage(products, slug, query.offset, now, query)
      : variantPage(products, slug, channelId, query.offset, now, query);
    if (!page) return Response.json({ error: 'Catalog entry unavailable' }, { status: 404, headers });
    const providerSlugs = new Set(mode === 'list' ? (page as ReturnType<typeof catalogPage>).rows.flatMap(r => r.quote?.providers.slug ?? [])
      : mode === 'channels' ? (page as NonNullable<ReturnType<typeof channelPage>>).rows.map(r => r.providers.slug) : []);
    const couponByProvider = Object.fromEntries(Object.entries(coupons).filter(([key]) => providerSlugs.has(key))
      .map(([key, offers]) => [key, offers.filter(offer => offer.expiresAt === null || new Date(offer.expiresAt).getTime() > now.getTime())]));
    const body = JSON.stringify({ mode, page, couponByProvider, requestedAt: now.toISOString() });
    if (new TextEncoder().encode(body).byteLength > MAX_RESPONSE_BYTES) {
      return Response.json({ error: 'Catalog page is too large; use the model detail page' }, { status: 503, headers });
    }
    return new Response(body, { headers });
  } catch {
    return Response.json({ error: 'Catalog temporarily unavailable' }, { status: 503, headers });
  }
}
