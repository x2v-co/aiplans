import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

const nextConfig: NextConfig = {
  // Production-only noise suppression — keep error/warn so real issues
  // still surface in Vercel logs.
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
      ? { exclude: ['error', 'warn'] }
      : false,
  },

  // Drop the X-Powered-By header — saves a few bytes per response and
  // gives slightly less fingerprinting info to bots.
  poweredByHeader: false,

  // Next.js per-package imports tree-shaking. Without this, importing
  // `{ Search } from 'lucide-react'` pulls in the entire icon library
  // (~200KB before gzip). The setting rewrites each import to target
  // the individual file so only the icons actually used ship.
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-accordion',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-label',
      '@radix-ui/react-popover',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-separator',
      '@radix-ui/react-slot',
      '@radix-ui/react-switch',
    ],
  },

  // Whitelist remote image hosts that next/image is allowed to
  // optimize. Without this, <Image src="https://cdn..."> falls back
  // to unoptimized rendering (no resizing, no modern formats). The
  // unoptimized flag on provider logos today means every request
  // ships the full PNG — allowing them here lets Vercel's image CDN
  // serve AVIF/WebP at the right resolution.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.in' },
      { protocol: 'https', hostname: 'aiplans.dev' },
      { protocol: 'https', hostname: 'www.aiplans.dev' },
      { protocol: 'https', hostname: 'openai.com' },
      { protocol: 'https', hostname: 'anthropic.com' },
      { protocol: 'https', hostname: 'google.com' },
      { protocol: 'https', hostname: 'www.google.com' },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
};

export default withNextIntl(nextConfig);
