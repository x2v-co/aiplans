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

The closed-loop events are separate and configurable (see
`docs/analytics-funnel-weekly.md`):

- `funnel_landing`: first page of a consented session, with UTM and traffic channel.
- `funnel_compare`: a comparison page view, a model add/remove, or a billing-period change.
- `funnel_outbound_click`: an external click, with provider channel type and slug when the link is tagged.
- `funnel_return_visit`: a new session after 30 minutes away. `prior_outbound=yes` means this browser used an outbound link before.

`funnel_landing`, `funnel_compare`, and `funnel_outbound_click` include `guide_slug` (a published guide slug, or `(not set)` off those pages). `funnel_alert_subscribe` is defined but not sent until the price-alert card exists.

`npm run report:funnel` prints the GA4 Query Explorer bodies for the last complete Monday–Sunday week. Register the event-scoped custom dimensions listed in that output before the page and channel splits return rows. That registration is a GA4 admin step, not a database migration.

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

## Bing Webmaster Tools

The site is verified with the public `msvalidate.01` metadata value emitted by
the locale layout. Keep this tag present after verification succeeds.

After adding `https://aiplans.dev`, submit:

- `https://aiplans.dev/sitemap.xml`

IndexNow complements this setup by notifying Bing about changed priority URLs;
it does not replace site ownership verification or sitemap monitoring.
