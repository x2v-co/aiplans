# Show HN 发布稿：Vendor Leaders + Exact-Model Channel Prices

规则核验：2026-09-04 阅读了 `https://news.ycombinator.com/showhn.html`。目标页面可
直接搜索、筛选和比较，不需要注册，不是单纯的文章或落地页，因此符合 Show HN 的
可试用要求。

## Submission

Title:

```text
Show HN: AIPlans - compare available AI model leaders and API channels
```

URL:

```text
https://aiplans.dev/en/compare/models?utm_source=hackernews&utm_medium=community&utm_campaign=model_selection_2026_09&utm_content=show_hn
```

Text:

```text
I built AIPlans around a two-step choice: compare one currently available model from
each major vendor, then compare the exact model across direct providers, cloud
platforms, and aggregators. The shortlist covers OpenAI, Anthropic,
Google, xAI, DeepSeek, GLM, Kimi, Qwen, and MiniMax. It uses Agent Arena as the
comparable performance signal and release date only as a fallback, so "newest"
is not silently treated as "best." GPT-6 Astra was announced today, but OpenAI
says broader API access is coming in the next few days, so the table keeps
GPT-5.6 Sol until an available channel is verified. The code and data pipeline
are open source. I would value feedback on this rule and the channel data.
```

## First Comment

```text
Hi HN - I maintain AIPlans.

Most model lists answer either "what is newest?" or "what is cheapest?" Neither
is enough to choose an API. AIPlans now starts with one current, purchasable,
general-purpose leader per vendor. The default rule is highest Agent Arena score
within that vendor; release recency breaks the gap when no comparable score is
available. The rule is shown on the page because it is a judgment, not a fact.

This distinction became concrete today: OpenAI describes GPT-6 Astra as its most
capable model, but its official page says broader API and plan access is coming
in the next few days. I show that rollout state rather than listing it as a
purchasable API prematurely. Once a channel is verified, the OpenAI row will
switch to GPT-6 Astra.

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
- Submitted at 2026-09-04 06:58:03 UTC (14:58:03 Asia/Singapore):
  `https://news.ycombinator.com/item?id=49561389`.
- HN displayed the submission at the top of `newest` immediately after
  publishing, then marked it `[flagged]`; the official item API reports
  `"dead": true`.
- The first comment was not posted because HN removes the comment form from a
  killed submission. Do not repost or try to bypass this state.
- HN documents that dead posts may be restored through community vouches, and
  that moderators sometimes turn off unfair flags. No vouches were requested
  or coordinated.
- Do not ask friends or other accounts to upvote or comment.
