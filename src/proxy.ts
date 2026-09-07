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

export default function proxy(request: NextRequest) {
  if (requestUsedHttp(request)) {
    const secureUrl = request.nextUrl.clone();
    secureUrl.protocol = 'https:';
    // NextResponse.redirect may serialize same-host redirects as a relative
    // Location in production. That would preserve the client's HTTP scheme
    // and loop, so keep the absolute HTTPS target explicit.
    return new NextResponse(null, {
      status: 308,
      headers: { Location: secureUrl.toString() },
    });
  }

  const { pathname } = request.nextUrl;

  // Check if pathname already has a locale
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (pathnameHasLocale) {
    return NextResponse.next();
  }

  // Redirect root to default locale
  if (pathname === '/') {
    const locale = request.cookies.get('NEXT_LOCALE')?.value || defaultLocale;
    request.nextUrl.pathname = `/${locale}`;
    return NextResponse.redirect(request.nextUrl);
  }

  // For other paths without locale, redirect to default locale
  if (!pathname.startsWith('/api') && !pathname.startsWith('/_next') && !pathname.includes('.')) {
    request.nextUrl.pathname = `/${defaultLocale}${pathname}`;
    return NextResponse.redirect(request.nextUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|go|_next/static|_next/image|favicon.ico).*)'],
};
