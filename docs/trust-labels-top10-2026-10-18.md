# 前 10 高流量页面数据可信标识核验（2026-10-18）

卡号：PVTI_lADOCjTjeM4Bmp6-zhBoNHk
需求：reczz28OutAMzfMV

本轮只覆盖下面 10 个模型页和套餐页。不改生产数据库，不加 migration。页面上的数字仍来自现有字段；标识只解释这些字段，不把估算或未入库的官方数字写成确定权益。

## 排名依据

仓库和生产库都没有页面浏览量。GA4 只在同意后发到 Google，不落库；`clicks` 记的是外链跳转，不是页面 PV。

2026-10-18 抓取生产首页 `https://aiplans.dev/zh` 的 HTML，当作现有访问入口：

- 「最新收录」4 张卡是新目录，不代表流量，不计入。
- 「高性能模型渠道比价」是首页唯一一组模型详情入口，顺序来自站内 Arena 热门排序。取前 6 个。
- 套餐页取首页文案点名、且生产环境返回 200 的订阅厂商页。ChatGPT、Claude、Gemini、GLM 四家。Kimi 会员页抓取长期不可用，本轮不把未核验套餐页算进名额。

| 序 | 路径 | 依据 |
| --- | --- | --- |
| 1 | `/models/anthropic-claude-fable-5-1` | 首页热门第 1 |
| 2 | `/models/anthropic-claude-opus-5-5` | 首页热门第 2 |
| 3 | `/models/anthropic-claude-sonnet-5-5` | 首页热门第 3 |
| 4 | `/models/openai-gpt-6-astra` | 首页热门第 4 |
| 5 | `/models/openai-gpt-6-1-sol` | 首页热门第 5 |
| 6 | `/models/openai-gpt-6-sol` | 首页热门第 6 |
| 7 | `/providers/openai` | ChatGPT 套餐页 |
| 8 | `/providers/anthropic` | Claude 套餐页 |
| 9 | `/providers/google` | Gemini 套餐页 |
| 10 | `/providers/zhipu-china` | GLM Coding 套餐页 |

名单在 `src/lib/data-trust.ts` 的 `TOP_TRUST_PAGES`。其它目录页不显示这套标识。厂商页上的 API 模型大表是全目录，本轮不逐行标注。

若之后有 GA4 或 Search Console 导出，应按真实 PV 重排这 10 个 slug，而不是沿用这次首页顺序。

## 每条关键数据的四项

只使用已有字段，外加本文件记录的官方 URL 常量：

| 项 | 价格 | 权益 |
| --- | --- | --- |
| 来源 | 官方渠道用下方核过的定价 URL；其它渠道用变体 `source_url`，否则 `providers.pricing_url` / `api_docs_url` / `website` | 套餐用下方官方套餐 URL；没有常量时用厂商 `pricing_url` |
| 适用条件 | 币种、计价单位、限时窗口、变体约束、数据折扣备注 | 同一套餐行的功能、限额、额度单位；联系销售和旧套餐宽限期写在条件里 |
| 最近核验 | `api_channel_prices.last_verified` 或变体的 `last_verified`，显示 UTC 日期 | `plans.last_verified` |
| 是否过期或估算 | 见下节。估算不会显示「已核验」 | 同上。句子里带「大约 / 估计 / approximately」的功能去掉确认勾，改标「估算」 |

缺来源链接、缺核验时间，或备注以 `[needs-verification]` 开头，状态是「待核验」。核验早于 30 天（与只读审计的 stale 窗口相同）标「核验已超过 30 天」。

过期提示：

- 介绍价的 `promo_ends_at` 已过，且没有可替换的常规价：红色「已过期」，并写明不要把该数字当成现行标价。
- 介绍价已过且常规价已换上：不标过期，条件里写明当前是常规价。
- 介绍价未到期：条件里写截止日（太平洋时间），并保留现有的「限时优惠」标记。
- `plans.legacy_ends_on` 早于当天：套餐标价和权益标「已过期」。
- 已被替代的额度估算：标「已过期」。

估算提示（琥珀色「估算」，不出现「已核验」）：

- 模型页「预估月度费用」：来源是本站方法论，条件是输入:输出 = 2:1 的四档假设，不是账单。
- 套餐上的额度估算：来源是公开证据链接，否则是方法论；条件写周期、配比和「不是厂商保证额度」。没有估算时仍显示「暂无已核验的额度估算」，不补一个假数字。
- 功能原文像估算句时，该行单独标「估算」。

## 本轮从来源到页面

抓取时间 2026-10-18。生产页是当时已上线的版本，还没有本 PR 的标识；下表核对的是数字和来源页是否一致。标识上线后，最近核验日仍读库里的 `last_verified`（这些 API 行页面上已显示 2026-10-17，未超过 30 天）。

### 模型 API 标价

来源：`https://platform.claude.com/docs/en/about-claude/pricing` 与 `https://developers.openai.com/api/docs/pricing` 的公开 HTML。

| 页面 | 生产页官方输入/输出 | 来源页标准价 | 结论 |
| --- | --- | --- | --- |
| Claude Fable 5.1 | USD 10 / 50，缓存 0.25 | $10 / $50 / MTok，缓存命中 $0.25 | 一致 |
| Claude Opus 5.5 | USD 4 / 20，缓存 0.20 | $4 / $20 / MTok，缓存命中 $0.20 | 一致。Fast mode 是另一档，变体上单独标来源 `https://docs.claude.com/en/docs/build-with-claude/fast-mode` |
| Claude Sonnet 5.5 | USD 2 / 10，缓存 0.10 | $2 / $10 / MTok，缓存命中 $0.10 | 一致 |
| GPT 6 Astra | USD 10 / 50，缓存 1 | 表头顺序下 input $10.00、cached input $1.00、output $50.00 | 标题价一致。长上下文和缓存写入是另一档，不能把 $10/$50 当成全部请求 |
| GPT 6.1 Sol | USD 2 / 10，缓存 0.10 | input $2.00、cached input $0.10、output $10.00 | 标题价一致 |
| GPT 6 Sol | 官方卡为「暂无官方报价」 | 定价 HTML 中没有 `gpt-6-sol` | 页面没有编造官方价。其它渠道的 $2/$10 必须带来源，不能叫官方价 |

Gemini 4 Argon 不在这 10 页的模型名单里，但它出现在 Google 厂商页的 API 表。来源 `https://ai.google.dev/gemini-api/docs/pricing`：输入 $2.00 至 2026-11-30，12 月 1 日起 $4.00；输出 $10.00 至 11 月 30 日，其后 $20.00。生产页已有 2026-11-30。本轮日期未过，应显示限时条件，不能把 $2/$10 写成永久标价。到期后若库里有常规价，现有读路径会换成常规价；没有常规价时，新标识标「已过期」。

### 套餐

| 页面 | 生产页 | 来源 | 结论 |
| --- | --- | --- | --- |
| OpenAI | Free、Go $8、Plus $20、Pro 100 $100 | `https://openai.com/chatgpt/pricing/` 本环境 403，未能重抓 | 链接仍作为来源。这次不能把这几档说成重新核过。见需处理事项 |
| Anthropic | Free $0、Pro $20、Max 5x $100、Max 20x $200 | `https://claude.com/pricing`：Free $0；Pro 月付 $20、年付预付 $200；Max「From $100」，并有 Max 5x / 20x。月度 API 额度列是 $100 与 $200，不是另一笔订阅费 | 订阅价没有看到相反数字。额度列不能被读成第二份月费 |
| Anthropic | Team Standard $30、Team Premium $150 | 标准席位年付 $20 / 月付 $25；高级席位年付 $100 / 月付 $125 | 不一致。价格标识强制「待核验」，不显示「已核验」。不改库 |
| Google | Plus、Pro 为「价格未知」且已有待核验文案；Ultra 5x $99.99、20x $199.99 | `https://gemini.google/subscriptions/`：Plus $4.99/月（约 2 倍免费档）；$19.99/月与约 4 倍免费档用量相邻；Ultra 起价 $99.99（5x）和 $199.99（20x） | Ultra 与页面一致。Plus/Pro 的官方数字只写进待核验说明，不写入价格，也不显示成已确认权益 |
| 智谱 | GLM Coding Lite ¥118、Pro ¥538、Max ¥1,078；额度估算为空 | `https://bigmodel.cn/pricing` 无 JavaScript 时没有价目正文 | 未能从 HTML 复核这三个月费。空估算保持「暂无已核验的额度估算」 |

适用条件里已写明：功能列表带「估算」的句子不是厂商保证额度；联系销售的 0 元不是公开成交价。

## 需老板处理

1. 用可访问 OpenAI 的网络重开 `https://openai.com/chatgpt/pricing/`，核对 Go $8、Plus $20、Pro 100 $100。本环境 403。
2. 决定是否修正 Claude Team Standard（现 $30，来源月付 $25 / 年付 $20）和 Team Premium（现 $150，来源月付 $125 / 年付 $100）。本 PR 只把这两行标成待核验。
3. 决定是否把 Google AI Plus $4.99、Google AI Pro $19.99 入库。入库前建议再看一次订阅页正文，因为 $19.99 是和「4 倍免费档用量」相邻，不是和标题写在同一句里。在此之前页面保持价格未知。
4. 在能执行页面脚本的环境打开智谱定价页，复核 GLM Coding 三档月费。
5. 若有 GA 或 Search Console，用真实 PV 替换 `TOP_TRUST_PAGES`。当前没有流量导出。

## 需 SRE 处理

没有。不需要生产 migration，也不需要为这次标识跑写库脚本。合入 main 会自动发生产；本变更只应停留在 PR，由老板决定何时合入。
