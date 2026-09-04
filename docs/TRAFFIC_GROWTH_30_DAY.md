# 30-Day Traffic Growth Execution

Start date: 2026-09-03  
Canonical domain: https://aiplans.dev  
Decision: defer AdSense until organic traffic is consistently around 50-100
visits per day and engagement quality is stable.

## Product And Content Strategy

The primary acquisition intent is now model selection, not model-price history:

1. Compare one current leading general-purpose model from each major vendor.
2. Use Agent Arena as the comparable performance signal; use release recency
   only when a vendor has no scored candidate. Do not equate newest with best.
3. After a user chooses a model, compare that exact model ID across official,
   cloud, aggregator, and reseller channels.
4. Keep historical prices for trend, migration, and deprecation research, but
   do not lead the homepage or community launch with them.

The first comparison covers OpenAI, Anthropic, Google, xAI, DeepSeek, GLM,
Kimi, Qwen, and MiniMax. It is generated from currently purchasable production
data rather than a static list of historical model versions.

## Verified Baseline

Search Console, previous three months:

- 11,996 impressions, 4 clicks, average position 68.5.
- 919 indexed URLs and 268 not indexed.
- 258 URLs were discovered but not crawled.
- About 12 backlinks from 3 referring domains.
- Query opportunities: ChatGLM API, Claude pricing/API cost, Grok pricing, and
  Kimi pricing.

GA4, previous 28 days:

- 583 active users, 579 new users, and 16 seconds average engagement time.
- Direct: 402 users.
- `cn.bing.com / referral`: 127 users and 150 sessions.
- `bing / organic`: 46 users and 47 sessions.
- `google / organic`: 4 users and 5 sessions.
- The Kimi guide was the strongest content entry with 112 views and 93 users.

## Completed

- Published bilingual Kimi, GLM/ChatGLM, Claude, and Grok pricing guides.
- Published the bilingual AI API Price Index and guides index.
- Reduced the sitemap from about 1,215 to 936 URLs and noindexed low-value
  generated comparison pages.
- Resubmitted the main sitemap in Search Console and started validation for the
  retired `/compare/models` 404 route.
- Requested indexing for the Price Index and GLM guide.
- Added IndexNow verification and submission; production deployment submits 14
  priority URLs after a successful release.
- Updated the Product Hunt listing and maker comment with current wording and
  deep links.
- Updated the GitHub repository description, topics, and README research links.
- Added consent-aware GA4 events for outbound links, comparison starts, model
  changes, pricing filters, and pricing search.
- Marked `outbound_click` and `compare_start` as GA4 key events and registered
  `link_domain`, `compare_type`, and `filter_name` custom dimensions.
- Added 1200x630 Open Graph and Twitter cards to pricing guides and the API
  Price Index. Production metadata and image responses were verified after
  deployment `33834732790`; the Price Index card renders the current 343
  priced models, 479 available channels, and 21 providers.
- Reframed the homepage and model-comparison flow around one current leader per
  major vendor, with release date, Agent Arena signal, context window, lowest
  input/output prices, and a direct link to every channel for that exact model.
- Verified nine production leaders across OpenAI, Anthropic, Google, xAI,
  DeepSeek, GLM, Kimi, Qwen, and MiniMax. The selection rule prefers the
  strongest comparable Agent Arena result instead of assuming newest is best.
- Production deployments `33837055795` and `33837874899` passed build, rollout,
  and IndexNow notification. Desktop and 390px mobile layouts, all nine rows,
  internal channel links, metadata, and the 1200x630 social card were verified.

## Channel Order

Publish one substantial post at a time and answer real comments before using
the next channel. Do not paste the same opening or title across communities.

| Order | Channel | Angle | Primary deep link |
| --- | --- | --- | --- |
| 1 | Hacker News | One current leader per vendor, then exact-model channel comparison | Model compare |
| 2 | V2EX | Nine-vendor leader table and the cases where newest is not strongest | Model compare |
| 3 | Zhihu | Answer a real cross-vendor model-selection question with current data | Model compare |
| 4 | Juejin | Explain the two-stage decision: choose a model, then choose its channel | Model compare |
| 5 | Reddit | Community-specific comparison, posted only where self-promotion rules permit | Matching guide |
| 6 | Developer newsletters | Current model leaders plus auditable channel-price data | Model compare |

## Campaign Links

Campaign name: `pricing_research_2026_09`

- Juejin model selection:
  `https://aiplans.dev/zh/compare/models?utm_source=juejin&utm_medium=community&utm_campaign=model_selection_2026_09&utm_content=vendor_leaders`
- V2EX model selection:
  `https://aiplans.dev/zh/compare/models?utm_source=v2ex&utm_medium=community&utm_campaign=model_selection_2026_09&utm_content=vendor_leaders`
- Zhihu model selection:
  `https://aiplans.dev/zh/compare/models?utm_source=zhihu&utm_medium=community&utm_campaign=model_selection_2026_09&utm_content=vendor_leaders`
- Hacker News model selection:
  `https://aiplans.dev/en/compare/models?utm_source=hackernews&utm_medium=community&utm_campaign=model_selection_2026_09&utm_content=show_hn`
- Reddit Claude:
  `https://aiplans.dev/en/guides/claude-anthropic-pricing?utm_source=reddit&utm_medium=community&utm_campaign=pricing_research_2026_09&utm_content=claude_guide`
- Newsletter model selection:
  `https://aiplans.dev/en/compare/models?utm_source=newsletter&utm_medium=referral&utm_campaign=model_selection_2026_09&utm_content=editorial_pitch`

The Product Hunt page already adds `?ref=producthunt`. Keep that referral URL
as-is so Product Hunt and GA4 remain comparable with the historical listing.

## Publishing Checklist

Before every post:

- Open the target deep link and confirm data, source links, canonical, and last
  verification date render correctly.
- Follow the community's current self-promotion rules.
- Lead with a useful pricing distinction or current dataset finding, not a
  product announcement.
- Disclose that the author maintains aiplans.dev.
- Use exactly one campaign link in the main post.
- Record the post URL and publication time below.

After publishing:

- Answer factual questions and corrections.
- Check GA4 acquisition by campaign and `outbound_click` after 24 and 72 hours.
- Record sessions, engaged sessions, key events, and genuine backlinks.
- Do not count profile links, private drafts, or submissions rejected by a
  moderator as acquired backlinks.

## Publication Log

| Date | Channel | Post URL | Landing page | Sessions after 72h | Backlink verified | Notes |
| --- | --- | --- | --- | ---: | --- | --- |
| 2026-09-04 | Hacker News | https://news.ycombinator.com/item?id=49561389 | https://aiplans.dev/en/compare/models | Pending | No | Published at 06:58:03 UTC; initially appeared at the top of `newest`, then was marked `[flagged]`/`dead`; first comment unavailable |

## Distribution Readiness

Verified on 2026-09-04:

| Channel | State | Next gate |
| --- | --- | --- |
| Juejin | Existing Kimi draft `7681467854781431818` retained as long-tail content; not the launch post | Rewrite around model selection after the new page deploys |
| V2EX | Community rules and `分享创造` node checked; flagship-comparison draft prepared | Verify the deployed comparison, then explicit approval |
| Zhihu | Logged in; existing single-brand answer retained for relevant questions only | Find a genuine cross-vendor selection question |
| Hacker News | Published item `49561389`; HN then marked it `[flagged]`/`dead` and closed comments | Do not repost; only pursue normal moderator review or organic vouching |
| Reddit | `r/ClaudeAI` and `r/LocalLLaMA` rules checked | Verify karma/content-history gates before posting |
| Newsletters | `console.dev` and Changelog News routes verified; tailored pitches prepared | Explicit approval before email/form submission; Changelog account required |

Prepared copy:

- `docs/distribution/JUEJIN_KIMI_2026-09-04.md`
- `docs/distribution/V2EX_PRICE_INDEX_2026-09-04.md`
- `docs/distribution/ZHIHU_GLM_2026-09-04.md`
- `docs/distribution/SHOW_HN_PRICE_INDEX_2026-09-04.md`
- `docs/distribution/REDDIT_CHANNEL_AUDIT_2026-09-04.md`
- `docs/distribution/NEWSLETTER_PITCH_2026-09-04.md`

## Bing Webmaster

Verified on 2026-09-04:

- Added `https://aiplans.dev` manually and verified ownership with the public
  `msvalidate.01` metadata tag.
- Submitted `https://aiplans.dev/sitemap.xml`. Bing completed its first crawl
  on 2026-09-04 with status `Success`, 936 URLs discovered, 0 errors, and 0
  warnings.
- URL Inspection reported `Indexed successfully`, `URL can appear on Bing`,
  and no SEO/GEO issues for:
  - `https://aiplans.dev/zh/guides/kimi-api-pricing`
  - `https://aiplans.dev/zh/reports/api-price-index`
  - `https://aiplans.dev/zh/guides/glm-chatglm-api-pricing`
  - `https://aiplans.dev/en/guides/claude-anthropic-pricing`
  - `https://aiplans.dev/en/guides/grok-pricing`
- Recommendations and Backlinks both showed `No data available` for the newly
  added property; this is not evidence that there are no issues or backlinks.
- Site Scan could not start because the account showed `Quota left: 0 pages`.
- The IndexNow dashboard still showed its onboarding screen. Production
  submissions are independently confirmed by successful HTTP responses and the
  deployment workflow; recheck whether Bing attributes them to this property.

## Content Cadence

- Publish one current cross-vendor selection comparison when the leader set or
  its decision materially changes.
- Publish at most one additional high-intent exact-model channel comparison or
  guide per week.
- Only create a price-change article when the price-history data contains a
  material change that affects a current leader or a migration decision.
- Do not bulk-generate thin pages while 258 discovered URLs are still waiting
  to be crawled.

## Measurement Dates and Targets

| Review | Date | Evidence to capture |
| --- | --- | --- |
| Day 7 | 2026-09-10 | Search Console page/query deltas, GA4 campaign sessions and key events, Bing crawl/index state |
| Day 14 | 2026-09-17 | Priority URL indexing, referring domains, organic sessions, engagement |
| Day 30 | 2026-10-03 | Full channel comparison and AdSense readiness decision |

Day-30 working targets:

- Google organic sessions: at least 20 in the comparable 28-day window.
- Bing-related sessions: at least 250 in the comparable 28-day window.
- At least 8 of the 14 priority URLs indexed.
- At least 8 genuine referring domains.
- Average engagement time: at least 25 seconds.

Targets are directional, not facts. Report actual values even when they miss
the target, and keep organic, referral, and campaign traffic separated.
