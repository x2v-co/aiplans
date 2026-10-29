import { planRedirectRequest, resolvePlanRedirect, withPlanRedirectCatalogTimeout, type PlanRedirectRow } from '@/lib/provider-redirects';
import { legacySlugRedirect } from '@/lib/legacy-slug-redirects';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const locales = ['en', 'zh'];
const defaultLocale = 'en';

export function requestUsedHttp(request: NextRequest): boolean {
  const cloudflareVisitor = request.headers.get('cf-visitor');
  if (cloudflareVisitor) {
    try {
      const visitor = JSON.parse(cloudflareVisitor) as { scheme?: unknown };
      if (visitor.scheme === 'http') return true;
    } catch {
      // Ignore malformed proxy metadata and fall back to the standard header.
    }
  }

  return request.headers.get('x-forwarded-proto')
    ?.split(',', 1)[0]
    .trim()
    .toLowerCase() === 'http';
}

// The catalog is loaded only for legacy /plans/:slug requests, never ordinary pages.
export function createProxy(
  loadCatalog: () => Promise<PlanRedirectRow[]> = async () => {
    const { getPlanRedirectCatalog } = await import('@/lib/plan-redirect-data');
    return getPlanRedirectCatalog();
  },
  staticPlanSegments: string[] = JSON.parse(process.env.PLAN_REDIRECT_STATIC_SEGMENTS || '[]'),
) {
  return async function proxy(request: NextRequest) {
    if (process.env.NODE_ENV === 'production' && requestUsedHttp(request)) {
      const secureUrl = request.nextUrl.clone();
      secureUrl.protocol = 'https:';
      // Next.js serializes same-host middleware redirects as relative Locations,
      // which preserve HTTP at the client and loop. Use the existing www alias
      // as a cross-host HTTPS hop; the gateway then redirects www to the apex.
      // The URL host inside the container may be localhost, so use the public
      // alias explicitly instead of deriving it from request.nextUrl.
      secureUrl.hostname = 'www.aiplans.dev';
      secureUrl.port = '';
      return new NextResponse(null, {
        status: 308,
        headers: { Location: secureUrl.toString() },
      });
    }

    const { pathname } = request.nextUrl;

    // Resolve before the locale redirect so locale-less plan URLs also take one hop.
    const planRequest = planRedirectRequest(pathname, staticPlanSegments);
    if (planRequest) {
      let catalog: PlanRedirectRow[] = [];
      if (planRequest.slug !== 'cursor') {
        try {
          catalog = await withPlanRedirectCatalogTimeout(loadCatalog);
        } catch (error) {
          console.warn('Unable to load plan redirect catalog; using provider slug fallback', error);
        }
      }
      const target = new URL(resolvePlanRedirect(planRequest, catalog), request.url);
      target.search = request.nextUrl.search;
      return NextResponse.redirect(target, 301);
    }

    // Check if pathname already has a locale
    const pathnameHasLocale = locales.some(
      (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
    );

    // Old catalog slugs 301 before the locale hop, so /models/gpt-6.1-sol does
    // not stop at a 404 on the way to /en/models/openai-gpt-6-1-sol.
    const localizedPath = pathnameHasLocale ? pathname : `/${defaultLocale}${pathname === '/' ? '' : pathname}`;
    const legacyTarget = legacySlugRedirect(localizedPath);
    if (legacyTarget) {
      const url = request.nextUrl.clone();
      url.pathname = legacyTarget;
      return NextResponse.redirect(url, 301);
    }

    if (pathnameHasLocale) {
      return NextResponse.next();
    }

    // Redirect root to default locale. Crawlers carry no cookie, so `/` → `/en`
    // is a permanent 308 and Google consolidates the homepage onto /en. A
    // visitor's saved non-default locale stays a temporary 307: a cached 308
    // would keep sending that browser to the old language after they switch.
    if (pathname === '/') {
      const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
      const locale = cookieLocale && locales.includes(cookieLocale) ? cookieLocale : defaultLocale;
      request.nextUrl.pathname = `/${locale}`;
      return NextResponse.redirect(request.nextUrl, locale === defaultLocale ? 308 : 307);
    }

    // For other paths without locale, redirect to default locale
    if (!pathname.startsWith('/api') && !pathname.startsWith('/v1') && !pathname.startsWith('/_next') && !pathname.includes('.')) {
      request.nextUrl.pathname = `/${defaultLocale}${pathname}`;
      return NextResponse.redirect(request.nextUrl);
    }

    return NextResponse.next();
  };
}

export default createProxy();

export const config = {
  matcher: ['/((?!api|v1|go|_next/static|_next/image|favicon.ico).*)'],
};
