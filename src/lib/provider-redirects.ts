/** Exactly one provider segment, excluding static plan routes and metadata. */
export function providerRedirects(staticSegments: string[] = []) {
  const reserved = [...new Set(['opengraph-image', 'twitter-image', 'icon', 'apple-icon', ...staticSegments])]
    .map(segment => segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return [
    // Cursor was folded into xAI; avoid a redirect chain through /plans/xai.
    { source: '/:locale(en|zh)/plans/cursor', destination: '/:locale/providers/xai', statusCode: 301 as const },
    {
      source: `/:locale(en|zh)/plans/:slug((?!(?:${reserved.join('|')})(?:\\.|/|$))[^/]+)`,
      destination: '/:locale/providers/:slug', statusCode: 301 as const,
    },
  ];
}
