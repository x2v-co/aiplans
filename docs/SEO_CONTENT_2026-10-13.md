# aiplans SEO 与内容执行批次：2026-10-13

状态：本地实现，未提交、未部署、未对外发布。本文不是流量增长结果报告。

## 这一批做什么

先增加一篇有实时数据、明确计费边界和官方来源的双语 OpenAI 指南，不批量扩充薄页面。

- 英文路径：`/en/guides/openai-api-pricing`
- 中文路径：`/zh/guides/openai-api-pricing`
- 主题：GPT API 成本、ChatGPT/Codex 订阅与 API Key 的区别、缓存与批处理、长上下文、工具附加费。
- 转化路径：指南 → 具体模型渠道对比 / 成本计算器 / OpenAI 套餐页。
- 技术项：复用 canonical / hreflang / OG；增加可见 FAQ 与一致的 FAQPage、BreadcrumbList；登记 sitemap 与部署后 IndexNow URL。
- 数据准确性：明确“最低输入价”不等于“最低总成本”；输出价格未知时不计算总额；核验日期对应实际显示的渠道；仅展示语言模型的每百万 token 报价。
- 不承诺 FAQ 富结果、收录或排名提升。FAQ 首先服务读者，结构化数据只是与正文一致的机器可读描述。

## 证据与限制

2026-10-13 在生产 PostgreSQL 中使用只读事务统计：

| 系列 | 有可用输入报价的模型数 | 价格行数 | 渠道数 |
| --- | ---: | ---: | ---: |
| GPT | 98 | 154 | 7 |
| Gemini | 39 | 69 | 4 |
| DeepSeek | 12 | 27 | 7 |
| Qwen | 50 | 72 | 5 |

此表按 slug 家族匹配、`is_available=true` 且输入价非空统计，含不同版本，并非搜索量、用户需求或所有报价都新鲜的证明。公开指南另外过滤 `type='llm'`、`price_unit='per_1m_tokens'`，最多展示 12 个模型。

本次没有重新读取 GSC/GA4；`TRAFFIC_GROWTH_30_DAY.md` 中的 9 月基线不能当作 10 月现状。

官方依据（2026-10-13 已通过浏览器读取）：

- https://developers.openai.com/api/docs/pricing
- https://developers.openai.com/codex/pricing/

`openai.com/api/pricing/` 和 Help Center 本次返回 403，因此正文引用可读的开发者文档，不宣称已核验被拦页面。

## 后续三篇：按周推进，不一次上线

| 顺序 | 选题 | 必须回答的独有问题 | 发布前闸门 |
| --- | --- | --- | --- |
| 2 | Gemini API 成本与 Google 订阅 | 开发者 API 与消费级套餐边界、不同服务入口和上下文计价 | 核对官方入口与条款；检查现有查询曝光；确认模型与渠道映射 |
| 3 | DeepSeek API 缓存命中与未命中成本 | 命中/未命中、推理输出、官方与聚合渠道的可比条件 | 从真实价格来源核验，不链接无套餐内容的厂商页；生产库当前 DeepSeek 套餐为 0 |
| 4 | Qwen API 国内外渠道与计费 | 百炼地区、币种、模型版本和上下文档位 | 核对地区计价规则，不把同家族不同部署当成同一商品 |

每周最多一篇，先处理已有文章的错误与真实反馈。如果抓取和索引仍不推进，应检查页面质量、内链及索引状态，而不是继续加 URL。

## 部署后验证清单

部署须另行批准；本批次没有执行 IndexNow、GSC 提交或社区发布。

1. 合并前同步远端新增提交，保护现有 market-radar 工作区修改。本次起点落后 `origin/main` 10 个提交，未执行自动 stash/rebase。
2. 确认两个新 URL 返回 200，未知指南 slug 返回 404；页面 SSR 含正文、FAQ、来源和真实价格。
3. 核对中英文 canonical / hreflang、OG 图、sitemap 项；确保指南列表、GPT 模型页和 OpenAI 套餐页能进入指南。
4. 在桌面及 375px 移动端核对长标题、表格横向滚动、正文和来源链接。
5. 逐条核对所展示价格的币种、处理模式和核验日期；批处理与交互式版本不可直接横比。选择一个真实模型手算示例成本。
6. 验证 JSON-LD 可解析且 FAQ 与可见正文相同；不要把语法正确等同于 Google 富结果资格。
7. 成功部署后确认现有 IndexNow 发布步骤包含这两个 URL。Google 收录另查 GSC URL Inspection，不把 IndexNow 接受当成 Google 已收录。
8. 建立本次发布日 GSC / GA4 基线，7/14/28 天再看数据。

## 记录指标

按中英文路径分开看，不只看全站 PV：

- GSC：是否已索引、查询曝光、自然点击、CTR、平均位置。
- GA4：organic landing sessions、engaged sessions、后续比较行为和 `outbound_click`。先验证内部跳转不会使关键事件归因丢失。
- 分发：每个帖子独立 UTM；24/72 小时看会话和关键事件；只有公开可访问的实际链接才记作引荐域名。
- 如果有曝光无点击，先改标题/摘要与搜索意图匹配；有访问无后续行为，先核对指南是否回答了问题及下一步入口。
- 如果低样本无法判断，标为“数据不足”，不宣称增长或强行改版。

## 中文分发草稿（待批准，未发布）

标题：买了 ChatGPT 订阅，为什么 API 还要单独付费？

正文：

先声明：我在维护 AI 价格对比站 aiplans.dev。

“GPT 多少钱”至少要先分清两个问题：你是在 ChatGPT/Codex 里通过订阅使用，还是在应用中通过 API Key 调用？OpenAI 的官方文档把 API token 计费与订阅用量分开，不能用订阅月费除以 API 单价，推算所谓“送了多少 token”。

API 预算可以先用这个基础公式：

`输入 token / 100万 × 输入单价 + 计费输出 token / 100万 × 输出单价`

例如 10,000 次请求，平均每次输入 1,000、输出 250 token，总量是 1,000 万输入和 250 万输出。实际预算还要核对缓存、批处理、长上下文、工具费和重试，不能只数用户最后发出的那句话。

另一个容易误判的点：输入价最低的渠道，总费用未必最低。输出占比高的任务，应一起比较输出价；输出价格没抓到，也不能按免费处理。

我把这些边界、已追踪的渠道报价和官方来源整理成了一个双语指南。不是“全网最低价”保证，而是希望让估算过程可以复核：

https://aiplans.dev/zh/guides/openai-api-pricing?utm_source=juejin&utm_medium=community&utm_campaign=openai_pricing_2026_10&utm_content=billing_explainer

使用提示：只在对应社区允许自荐且能解决具体问题时发布；若换平台，改写开场和 `utm_source`，不要跨站机械复制。

## English distribution draft (not published)

Title: Why a ChatGPT subscription is not an API token budget

I maintain aiplans.dev, an AI pricing comparison site. One distinction worth making before estimating GPT costs: subscription usage and API-key billing are different paths, including in Codex.

For a basic uncached text estimate, multiply input and billable output tokens by their respective rates. Then check cache rules, processing mode, context tier and tool charges. Comparing only the lowest input price can pick the wrong channel for output-heavy work.

I wrote a guide with tracked channel prices, a reproducible workload example and links to the official billing docs. It labels missing output prices as unknown, not zero, and does not claim to cover every model or fee.

https://aiplans.dev/en/guides/openai-api-pricing?utm_source=newsletter&utm_medium=referral&utm_campaign=openai_pricing_2026_10&utm_content=billing_explainer

Adapt to a specific publication or relevant discussion. Do not send unsolicited bulk pitches, post where self-promotion is disallowed, or use this link before deployment verification.
