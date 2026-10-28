# Full search-intent release — 2026-10-28

This completes the supplied export review, extending the initial DeepSeek change. The query export has 1,000 rows; the page export has 878. They are separate aggregates, not a query × URL join, and the export date does not establish the reporting window.

## Coverage

Every query has a family, intent, intended route and treatment in [the query map](search-query-map-2026-10-28.csv). The [page map](search-page-map-2026-10-28.csv) records existing provider redirects, active model routes and historical/thin comparisons. Destination selection uses actual catalogue identifiers; it does not create URLs from misspelled or retired model names.

| Family | Queries | Clicks | Impressions |
| --- | ---: | ---: | ---: |
| Claude / Anthropic / Opus / Sonnet / Fable | 261 | 0 | 896 |
| Kimi / Moonshot / 月之暗面 | 139 | 1 | 653 |
| Grok | 113 | 0 | 319 |
| GLM / ChatGLM | 59 | 1 | 301 |
| Gemini / Gemma / Nano Banana | 95 | 0 | 295 |
| OpenAI / ChatGPT / GPT / Codex | 120 | 1 | 278 |
| Qwen | 91 | 0 | 238 |
| General AI pricing, subscriptions and calculators | 26 | 0 | 135 |
| DeepSeek | 25 | 4 | 89 |
| Other named providers | 62 | 0 | 172 |
| Excluded external or unrelated products | 9 | 0 | 14 |

Grouping includes observed alternate spellings, so these figures differ from the initial substring-only table. Of the 1,000 queries, 991 receive an on-site destination. Nine external/unrelated queries are explicitly excluded: canals ai pricing, private ai pricing, ai sdk pricing, artificialanalysis.ai pricing, ai collaboration platform pricing for product engineering teams, how much do ai content gap discovery platforms typically cost?, profound vs maya ai pricing, ai networking platform pricing, opentherank. We do not publish unsupported pricing pages for these products.

English and Chinese pages are optimized. Russian, French and other-language search terms route to an appropriate existing English page; this release does not claim to add those site locales. Typo variants inform intent mapping, not visible keyword stuffing.

## Changes by intent

- **Brand pricing / subscriptions:** provider titles use product and creator names together (Claude/Anthropic, Kimi/Moonshot, GLM/Z.AI, Gemini/Google, Qwen, OpenAI/ChatGPT). Monthly floors and tier names come only from subscription rows. API-only providers do not advertise nonexistent subscription tiers. Each provider page has a price-oriented H1, specific buying/billing guidance, API/plan anchors, calculator links and relevant guide links. Smaller providers use truthful generic guidance.
- **Specific subscriptions:** localized comparison titles, introductions, billing FAQ and keyword-bearing internal links. Provider links select globally indexable comparisons before narrowing to that provider, with that provider’s own models shown first. The requested DeepSeek V4.1 Flash landing page receives the brand-level subscription phrase and priority while eligible. Historical Kimi pages retain their existing noindex/canonical policies and now offer relevant guide/provider navigation.
- **API price / cost / cheapest:** model titles and the visible price summary cover API costs and token prices. A worked 1M-input + 250K-output example uses the actual lowest-input channel’s native currency and known output rate; it explicitly does not claim lowest total cost. Missing output rates suppress the example.
- **Free API:** a model is described as having a recorded zero-token-price route only when an available channel has both input and output rates at zero. Missing rates, zero cache prices and free chat tiers do not establish free APIs. Visible FAQs and JSON-LD share one answer source.
- **Kimi, GLM, Claude and Grok broad pricing:** existing guide titles now match the dominant query phrases; top navigation leads to the named provider’s prices and plans. Existing sourced editorial facts are retained.
- **API market / calculator:** comparison intro explicitly describes exploring the AI API market. Calculator copy covers inference/token budgeting, caching and batch usage and makes clear that it does not read connected billing dashboards. Homepage fallback removes stale GPT-4-only emphasis.
- **Image, video and world-model terms:** keep existing category-specific billing units and routes; do not apply text-token arithmetic to these pages. Provider guidance directs users to the correct type of workload. Existing dedicated world-model catalogue remains the destination for foundation-model queries.

## Validation

Pre-release validation: 679 unit tests passed, 3 skipped; production build and TypeScript passed. Independent review findings were fixed with regressions for global indexability, subscription-only counts and provider-owned model ordering. Representative server-rendered pages are checked for HTTP status, titles, H1, canonicals, robots, internal links and FAQ JSON-LD. The deployed revision and final production checks are recorded in the PR and release summary. Prices, free status, model availability and indexability remain database-driven. No pricing data or subscription entitlements are changed by this release.

After deployment, inspect the title/H1/canonical/robots, provider links, guide links and shared FAQ JSON-LD on representative pages for every major family. Compare Search Console query × page outcomes after recrawling; ranking and Google's landing-page selection are not guaranteed by metadata changes.
