# Google Analytics and Search Console

The application supports both services without requiring a hosting-provider
integration. Values are read from the environment and are intentionally not
committed to the repository.

## Google Analytics 4

1. Create or select a GA4 Web data stream for `https://aiplans.dev`.
2. Copy its Measurement ID (`G-XXXXXXXXXX`).
3. Set `NEXT_PUBLIC_GA_ID` in the production environment.
4. Redeploy the app.

The app sends an initial `page_view` and additional `page_view` events when
the Next.js App Router changes route. When the variable is empty, no Google
script is emitted.

After analytics consent, the app also sends these product events:

- `outbound_click`: a visitor follows an external provider or source link.
- `compare_start`: a visitor opens a localized model or plan comparison.
- `comparison_model_change`: a visitor adds or removes a model in the comparison tool.
- `pricing_filter_change`: a visitor changes a pricing region, channel, sort, or access filter.
- `pricing_search`: a visitor finishes a non-empty search in the API pricing table.

Mark `outbound_click` and `compare_start` as key events in GA4. Keep the other
events as diagnostic interaction signals. Event collection follows the site's
analytics consent preference; no events are sent before consent.

## Search Console

For a URL-prefix property, copy the HTML tag verification value and set
`GOOGLE_SITE_VERIFICATION` to the `content` value. The app emits the
`google-site-verification` meta tag on every locale page.

For a Domain property, add the TXT record requested by Search Console at the
DNS provider instead. Domain verification is independent of the app and does
not require a code change.

After verification, submit:

- `https://aiplans.dev/sitemap.xml`
- `https://aiplans.dev/robots.txt`

Keep the Search Console property and GA4 data stream on the canonical HTTPS
domain. `www.aiplans.dev` should remain a redirect or canonical alias.
