# 30-Day Traffic Growth Execution

Start date: 2026-09-03  
Canonical domain: https://aiplans.dev  
Decision: defer AdSense until organic traffic is consistently around 50-100
visits per day and engagement quality is stable.

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

## Channel Order

Publish one substantial post at a time and answer real comments before using
the next channel. Do not paste the same opening or title across communities.

| Order | Channel | Angle | Primary deep link |
| --- | --- | --- | --- |
| 1 | Juejin | How API channels and subscriptions distort cost comparisons | Kimi guide |
| 2 | V2EX | Show the data method, ask developers to report missing channels | Price Index |
| 3 | Zhihu | Answer a real Kimi/GLM/Claude API pricing question in depth | Matching guide |
| 4 | Hacker News | Open-source, auditable AI API price index; ask for data feedback | Price Index |
| 5 | Reddit | Community-specific comparison, posted only where self-promotion rules permit | Matching guide |
| 6 | Developer newsletters | Short editorial pitch with current dataset scope and GitHub link | Price Index |

## Campaign Links

Campaign name: `pricing_research_2026_09`

- Juejin Kimi:
  `https://aiplans.dev/zh/guides/kimi-api-pricing?utm_source=juejin&utm_medium=community&utm_campaign=pricing_research_2026_09&utm_content=kimi_guide`
- V2EX Price Index:
  `https://aiplans.dev/zh/reports/api-price-index?utm_source=v2ex&utm_medium=community&utm_campaign=pricing_research_2026_09&utm_content=price_index`
- Zhihu GLM:
  `https://aiplans.dev/zh/guides/glm-chatglm-api-pricing?utm_source=zhihu&utm_medium=community&utm_campaign=pricing_research_2026_09&utm_content=glm_guide`
- Hacker News Price Index:
  `https://aiplans.dev/en/reports/api-price-index?utm_source=hackernews&utm_medium=community&utm_campaign=pricing_research_2026_09&utm_content=show_hn`
- Reddit Claude:
  `https://aiplans.dev/en/guides/claude-anthropic-pricing?utm_source=reddit&utm_medium=community&utm_campaign=pricing_research_2026_09&utm_content=claude_guide`
- Newsletter Price Index:
  `https://aiplans.dev/en/reports/api-price-index?utm_source=newsletter&utm_medium=referral&utm_campaign=pricing_research_2026_09&utm_content=editorial_pitch`

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
| | | | | | | |

## Bing Webmaster

Pending account login and site authorization:

1. Import the verified `aiplans.dev` property from Google Search Console when
   the account offers that option; otherwise add the domain and verify it.
2. Submit `https://aiplans.dev/sitemap.xml`.
3. Inspect the Price Index, Kimi guide, GLM guide, Claude guide, and Grok guide.
4. Review URL Submission, Site Scan, and SEO Reports for actionable errors.
5. Record the verified property and submission result here. Do not claim Bing
   configuration is complete until the dashboard confirms it.

## Content Cadence

- Publish at most one evidence-backed price-change report per week.
- Publish at most one additional high-intent comparison or guide per week.
- Only create a price-change article when the price-history data contains a
  material change that can be cited.
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
