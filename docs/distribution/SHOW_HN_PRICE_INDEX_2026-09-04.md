# Show HN 发布稿：AI API Price Index

规则核验：2026-09-04 阅读了 `https://news.ycombinator.com/showhn.html`。目标页面可
直接搜索、筛选和比较，不需要注册，不是单纯的文章或落地页，因此符合 Show HN 的
可试用要求。

## Submission

Title:

```text
Show HN: AIPlans - compare AI API prices across providers and channels
```

URL:

```text
https://aiplans.dev/en/reports/api-price-index?utm_source=hackernews&utm_medium=community&utm_campaign=pricing_research_2026_09&utm_content=show_hn
```

Text:

```text
I built AIPlans to make API price comparisons auditable across direct providers,
cloud platforms, and aggregators. The current index covers 343 priced models,
479 available channels, and 21 providers. It preserves each vendor's billing
currency, uses normalized USD only for cross-channel ranking, and links prices
back to their source and verification date. The code and data pipeline are open
source. I would especially value feedback on model aliasing, cache/batch pricing,
and channels that are missing or stale.
```

## First Comment

```text
Hi HN - I maintain AIPlans.

I started this because "what does model X cost?" often mixes together a direct
API, cloud marketplaces, aggregators, different currencies, and sometimes even
different model revisions. The index compares exact model IDs across channels,
keeps the original billing currency, and uses a fixed example workload of 1M
input + 250k output tokens so each result can be recalculated.

Free routes are shown but excluded from the cheapest-paid ranking because their
limits and availability are different. Each row links to its source and records
when it was last checked. The repository is at:
https://github.com/x2v-co/aiplans

The hardest parts so far are model aliases and representing cache/batch tiers
without implying that every workload qualifies for them. Feedback on those data
choices, missing providers, or stale prices would be particularly useful. I am
around to answer questions and fix factual issues.
```

## Current State

- Hacker News login confirmed on 2026-09-04.
- Submission form prefilled with the title, URL, and text above.
- The final `submit` action has not been performed.
- Do not ask friends or other accounts to upvote or comment.

