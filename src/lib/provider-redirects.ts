/** Exactly one provider segment, excluding static plan routes and metadata. */
export function providerRedirects(staticSegments: string[] = []) {
  const reserved = [...new Set(['opengraph-image', 'twitter-image', 'icon', 'apple-icon', ...staticSegments])]
    .map(segment => segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const slug = `:slug((?!(?:${reserved.join('|')})(?:\\.|/|$))[^/]+)`;
  return [
    // Cursor was folded into xAI; avoid a redirect chain through /plans/xai.
    { source: '/:locale(en|zh)/plans/cursor', destination: '/:locale/providers/xai', statusCode: 301 as const },
    { source: `/:locale(en|zh)/plans/${slug}`, destination: '/:locale/providers/:slug', statusCode: 301 as const },
    // Locale-less /plans/<provider> used to hop /plans/x → /en/plans/x (proxy
    // locale redirect) → /en/providers/x. Config redirects run before the
    // proxy, so send it to the default-locale provider page in one hop.
    { source: '/plans/cursor', destination: '/en/providers/xai', statusCode: 301 as const },
    { source: `/plans/${slug}`, destination: '/en/providers/:slug', statusCode: 301 as const },
  ];
}
