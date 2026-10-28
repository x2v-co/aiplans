# Search intent improvements — 2026-10-28

Initial-round notes. See [full query coverage](search-coverage-2026-10-28.md) for the completed release scope.

Source: supplied Search Console exports `查询数.csv` (1,000 rows) and `网页.csv` (878 rows). Export date is not the reporting window. Query and page tables are independent aggregates: they cannot establish which URL appeared for every query.

## Evidence and landing pages

| Query family (substring grouping) | Query rows | Clicks | Impressions | Intent routing |
| --- | ---: | ---: | ---: | --- |
| DeepSeek | 24 | 4 | 87 | Subscription → model plan comparison; API → model pricing |
| Kimi / Moonshot / 月之暗面 | 135 | 1 | 635 | Model subscription → comparison; broad pricing/API → existing Kimi guide |
| Claude / Anthropic | 209 | 0 | 791 | Subscription tiers → provider; model access → comparison; API → existing Claude guide/model pricing |
| GLM / ChatGLM | 58 | 1 | 299 | API → existing GLM/ChatGLM guide; subscription → model comparison |
| Grok | 112 | 0 | 318 | API → existing Grok guide/model pricing; subscription → comparison |
| OpenAI | 37 | 1 | 85 | Brand subscription → provider; API → existing OpenAI guide |

`deepseek 订阅` and `deepseek订阅` together have 4 clicks / 13 impressions. The user reports Google sending this intent to `/zh/plans/deepseek`; that URL has 4 clicks / 21 impressions across all queries in the page export. The requested target is `/zh/compare/plans/deepseek-v4.1-flash`.

Live target inspection showed HTTP 200, a self-canonical URL, two plans and a $10 monthly floor. These observations are not hardcoded into content. The latest main branch already redirects legacy provider `/plans/[provider]` paths to `/providers/[slug]`.

## Implementation

- Comparison metadata and visible headings explicitly say subscription / 订阅套餐. The requested DeepSeek model also leads with the brand-level search phrase.
- Preserve database-derived prices, currencies, canonicals, alternate languages and existing indexing eligibility. Subscription counts exclude PAYG and token packs.
- Add bilingual explanatory copy and FAQ distinguishing third-party model access, creator memberships and pay-as-you-go API charges. Visible FAQ and JSON-LD share the same answer.
- Add server-rendered subscription comparison links near the top of provider pages. Candidates derive from real model-plan mappings and apply the global current-series, primary-variant, minimum-two-plan filter before intersecting the provider’s models. Retired models are excluded in SQL. DeepSeek V4.1 Flash is preferred only while eligible; links are capped at six.
- Replace generic model-page “View Details” anchors with the model name and subscription/pricing intent. Link back to model API pricing from comparison pages.

## Validation and rollout

16 targeted tests pass. Full npm test: 669 total, 666 passed, 3 skipped, zero failures. Production build (including TypeScript) passes. ESLint passes for the changed SEO logic and comparison/provider routes; the existing model page has four unrelated warnings.

Local production preview was checked against existing database data through the SSH tunnel to x2v-global (read-only page queries). The DeepSeek provider page links first to the requested V4.1 Flash comparison. The comparison returns HTTP 200, index/follow, the production self-canonical URL, the subscription heading, a database-derived two-plan/$10 snippet, and matching FAQ JSON-LD. At 375px viewport width there is no horizontal overflow; introductory copy was shortened for mobile. The legacy Kimi K2 comparison retains its existing noindex and canonical-to-current-catalog behavior rather than promoting an empty page.

The first round was validated locally on seo/search-intent-20261028. The user subsequently requested complete export coverage and a combined deployment; see the full coverage report and PR for current release status. No pricing data writes are included.

After deployment, verify the legacy provider redirect, new provider links, DeepSeek/Kimi comparison titles and visible content, FAQ JSON-LD, robots and canonical tags. Request indexing for the DeepSeek target and monitor query × page results in Search Console. Google chooses the result URL; these changes cannot guarantee a specific landing page. Preserve provider pages for brand/product intents instead of redirecting all of their traffic to one model.
