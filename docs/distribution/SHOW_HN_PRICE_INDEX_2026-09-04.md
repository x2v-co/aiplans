# Show HN 发布稿：Vendor Leaders + Exact-Model Channel Prices

规则核验：2026-09-04 阅读了 `https://news.ycombinator.com/showhn.html`。目标页面可
直接搜索、筛选和比较，不需要注册，不是单纯的文章或落地页，因此符合 Show HN 的
可试用要求。

## Submission

Title:

```text
Show HN: AIPlans - compare leading AI models, then their API channels
```

URL:

```text
https://aiplans.dev/en/compare/models?utm_source=hackernews&utm_medium=community&utm_campaign=model_selection_2026_09&utm_content=show_hn
```

Text:

```text
I built AIPlans around a two-step choice: compare one current leading model from
each major vendor, then compare the exact model across direct providers, cloud
platforms, and aggregators. The shortlist currently covers OpenAI, Anthropic,
Google, xAI, DeepSeek, GLM, Kimi, Qwen, and MiniMax. It uses Agent Arena as the
comparable performance signal and release date only as a fallback, so "newest"
is not silently treated as "best." The code and data pipeline are open source.
I would value feedback on this selection rule and the channel data.
```

## First Comment

```text
Hi HN - I maintain AIPlans.

Most model lists answer either "what is newest?" or "what is cheapest?" Neither
is enough to choose an API. AIPlans now starts with one current, purchasable,
general-purpose leader per vendor. The default rule is highest Agent Arena score
within that vendor; release recency breaks the gap when no comparable score is
available. The rule is shown on the page because it is a judgment, not a fact.

Once a model is selected, its detail page compares that exact model ID across
official APIs, cloud marketplaces, and aggregators. It keeps the original billing
currency and normalizes to USD only for ranking.

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
- The title, URL, submission text, and first comment are stored above. HN does
  not provide a persistent draft, so browser form contents are not treated as
  saved state.
- The final `submit` action has not been performed.
- Do not ask friends or other accounts to upvote or comment.
