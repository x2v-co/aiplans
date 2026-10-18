# Analytics events & UTM conventions

## GA4 events (src/lib/analytics.ts, src/components/GoogleAnalytics.tsx)

| Event | When | Params |
|---|---|---|
| `guide_model_click` | On `/{locale}/guides/{slug}`, click to `/{locale}/models/{x}` or `/{locale}/plans/{x}` | `guide_slug`, `target_type` (`model`/`plan`), `target_slug`, `target_path`, `position` (row in guide table, if any) |
| `compare_start` | Click to `/{locale}/compare/models|plans` | `compare_type`, `target_path`, `guide_slug` (when clicked on a guide) |
| `outbound_click` | Click to another origin | `link_domain`, `link_text`, `link_url`, `guide_slug` (when clicked on a guide) |

Funnel: landing on guide (page_view with `utm_*`) → `guide_model_click` → `compare_start` → `outbound_click`.
In GA4, register `guide_slug`, `target_type`, `target_slug` as event-scoped custom dimensions to report on them.

## Closed loop (visit → compare → outbound → return)

Configurable names default to `funnel_landing`, `funnel_compare`, `funnel_outbound_click`, and `funnel_return_visit` (`src/config/analytics-events.ts`). Override with `NEXT_PUBLIC_ANALYTICS_EVENT_LANDING`, `_COMPARE`, `_OUTBOUND`, and `_RETURN`. The weekly GA4 queries are `npm run report:funnel` and `docs/analytics-funnel-weekly.md`.

Events fire only after analytics consent. Parameters are page family, UTM tokens, provider channel, and coarse return buckets. They do not include an account id, email, query string, or full outbound URL. A browser-local visit note (day, session count, outbound flag) is deleted when analytics is rejected.

## UTM rules

All links we place off-site (community answers, outreach, newsletters) carry UTM; links inside aiplans.dev never do.

- `utm_source`: the site, lowercase: `zhihu`, `juejin`, `v2ex`, `x`, `reddit`, `github`, `newsletter`, `email`, `rss`.
- `utm_medium`: `community` (answers/posts), `outreach` (1:1 author contact), `social`, `email` (price alerts), `rss`.
- `utm_campaign`: `acq-2026-11` for this month's acquisition test; `price-alert` for alert emails/RSS.
- `utm_content`: guide slug or model slug the link points to, plus a short distinguisher if needed, e.g. `openai-api-pricing`, `cursor-x-subscription-pricing-q2`.
- `utm_term`: unused.
- Lowercase, hyphens only, no spaces or personal data.
- Link to the matching guide or model page, not the home page.

Example: `https://aiplans.dev/zh/guides/openai-api-pricing?utm_source=zhihu&utm_medium=community&utm_campaign=acq-2026-11&utm_content=openai-api-pricing`
