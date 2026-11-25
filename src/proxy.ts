import { isInfrastructurePath } from '@/lib/route-locale';
import { planRedirectRequest, resolvePlanRedirect, withPlanRedirectCatalogTimeout, type PlanRedirectRow } from '@/lib/provider-redirects';
import { legacySlugRedirect } from '@/lib/legacy-slug-redirects';
import { isSeoCatalogDetail } from '@/lib/seo-redirects';
import { decodeSlugParam } from '@/lib/route-params';
import { filteredCatalogPath, publicPathForFilteredRoute } from '@/lib/catalog-query-routes';
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
  destinationIndexable: (path: string) => Promise<boolean> = async path => {
    const { seoDestinationIndexable } = await import('@/lib/seo-redirects');
    return seoDestinationIndexable(path);
  },
  comparisonPage: (slug: string) => Promise<{ redirect: string | null } | null> = async slug => {
    const { getComparisonPage } = await import('@/lib/model-plan-comparison');
    return getComparisonPage(slug);
  },
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
      if (await destinationIndexable(target.pathname)) return NextResponse.redirect(target, 301);
      // Resolve the same provider/plan without a permanent hop to noindex.
      // Its existing metadata supplies noindex,follow and the canonical path.
      target.hash = '';
      target.pathname = filteredCatalogPath(target.pathname, target.searchParams) ?? target.pathname;
      return NextResponse.rewrite(target);
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
      const comparison = /^\/(en|zh)\/compare\/plans\/([^/]+)\/?$/.exec(localizedPath);
      if (comparison) {
        const resolved = await comparisonPage(decodeSlugParam(comparison[2]));
        if (resolved?.redirect) {
          const url = request.nextUrl.clone();
          url.pathname = resolved.redirect.replace(/^\/en\//, `/${comparison[1]}/`);
          return NextResponse.redirect(url, 301);
        }
        // The comparison route renders its own noindex fallback, including
        // known aliases with no equivalent subscription payload.
        if (pathnameHasLocale) return NextResponse.next();
        const url = request.nextUrl.clone();
        url.pathname = localizedPath;
        return NextResponse.rewrite(url);
      }
      const url = request.nextUrl.clone();
      url.pathname = legacyTarget;
      if (await destinationIndexable(legacyTarget)) return NextResponse.redirect(url, 301);
      return NextResponse.rewrite(url);
    }

    if (pathnameHasLocale) {
      // /[locale]/filtered/... is an internal rewrite target only; never let it
      // become a second public URL for the same content.
      const publicPath = publicPathForFilteredRoute(pathname);
      if (publicPath) {
        if (isSeoCatalogDetail(publicPath) && !await destinationIndexable(publicPath)) return NextResponse.next();
        const url = request.nextUrl.clone();
        url.pathname = publicPath;
        return NextResponse.redirect(url, 301);
      }
      // Catalog pages are cached (ISR); filtered query variants render per request.
      const filteredPath = filteredCatalogPath(pathname, request.nextUrl.searchParams);
      if (filteredPath) {
        const url = request.nextUrl.clone();
        url.pathname = filteredPath;
        return NextResponse.rewrite(url);
      }
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

    // Dots also occur in model slugs (minimax-m3.1-flash). Only known file
    // extensions bypass locale routing; an arbitrary dot is not a static file.
    // Keep this list in sync with the file types under public/ (md: /reports/*.md).
    const isStaticFile = /\.(?:avif|bmp|css|csv|eot|gif|html|ico|jpe?g|js|json|map|md|mjs|mp3|mp4|ogg|otf|pdf|png|svg|ttf|txt|wasm|webm|webmanifest|webp|woff2?|xml|zip)$/i.test(pathname);
    if (!isInfrastructurePath(pathname) && !isStaticFile) {
      request.nextUrl.pathname = `/${defaultLocale}${pathname}`;
      const comparison = /^\/en\/compare\/plans\/([^/]+)\/?$/.exec(request.nextUrl.pathname);
      if (comparison) {
        const resolved = await comparisonPage(decodeSlugParam(comparison[1]));
        if (resolved?.redirect) {
          request.nextUrl.pathname = resolved.redirect;
          return NextResponse.redirect(request.nextUrl, 301);
        }
        return NextResponse.rewrite(request.nextUrl);
      }
      if (isSeoCatalogDetail(request.nextUrl.pathname) && !await destinationIndexable(request.nextUrl.pathname)) {
        request.nextUrl.pathname = filteredCatalogPath(request.nextUrl.pathname, request.nextUrl.searchParams) ?? request.nextUrl.pathname;
        return NextResponse.rewrite(request.nextUrl);
      }
      // Same rule as `/` → `/en`: crawlers have no locale cookie, so a
      // permanent 308 lets Google consolidate locale-less URLs onto /en/...
      return NextResponse.redirect(request.nextUrl, 308);
    }

    return NextResponse.next();
  };
}

export default createProxy();

export const config = {
  matcher: ['/((?!(?:api|v1|go)(?:/|$)|_next/static|_next/image|favicon\\.ico$).*)'],
};
