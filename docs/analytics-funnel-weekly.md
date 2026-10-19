# 访问 → 比较 → 出站 → 回访 周报

现有分析工具是站点里的 Google Analytics 4（`NEXT_PUBLIC_GA_ID`）。本文件是周报查询，不新增分析产品，不读、不写生产数据库。

事件名在 `src/config/analytics-events.ts`。默认名如下，构建时可分别用环境变量覆盖（非法名字会回退到默认值）：

| 环节 | 配置键 | 默认事件名 | 环境变量 |
|---|---|---|---|
| 访问 / 落地来源 | `landing` | `funnel_landing` | `NEXT_PUBLIC_ANALYTICS_EVENT_LANDING` |
| 比较 | `compare` | `funnel_compare` | `NEXT_PUBLIC_ANALYTICS_EVENT_COMPARE` |
| 出站点击（含渠道） | `outboundClick` | `funnel_outbound_click` | `NEXT_PUBLIC_ANALYTICS_EVENT_OUTBOUND` |
| 回访 | `returnVisit` | `funnel_return_visit` | `NEXT_PUBLIC_ANALYTICS_EVENT_RETURN` |
| 价格提醒订阅（未接入） | `alertSubscribe` | `funnel_alert_subscribe` | `NEXT_PUBLIC_ANALYTICS_EVENT_ALERT` |

**事件只在访客同意分析后才发送，绝对数会偏低，只适合看趋势和渠道之间的对比。** 未同意的访问不会出现在任何查询里，不能把这些人数当成全站 UV。

不采集账号、邮箱、IP（由应用写入）、查询字符串、出站链接完整地址，也不生成用户标识。

`funnel_alert_subscribe` 只是占位。价格变动提醒还没做，当前没有任何页面发送它，周报查询也不包含它。提醒卡上线时再接入，参数为 `page_group`、`guide_slug`、`model_slug`、`channel`（`email` 或 `rss`）。届时再注册自定义维度 `channel`。

本地打印本周查询（不访问 Google、不访问数据库）：

```bash
npm run report:funnel
```

把输出的 JSON 贴到 [GA4 Query Explorer](https://ga-dev-tools.google/ga4/query-explorer/) 里已有的媒体资源。日期是 UTC 下「今天之前最近一个完整的周一至周日」。

## 指标清单（供对齐）

用各查询里的 `totalUsers`，不要用事件次数当人数。

| 指标 | 算法 | 说明 |
|---|---|---|
| 落地人数 | `funnel_landing` 的 totalUsers | 每个同意分析的浏览器会话记一次。带落地页、UTM、流量渠道 |
| 比较人数 | `funnel_compare` 的 totalUsers | 打开比较页、在模型比较里增删模型，或切换月付/年付 |
| 出站人数 | `funnel_outbound_click` 的 totalUsers | 点击离开本站。商业链接带渠道类型和渠道 slug |
| 回访人数 | `funnel_return_visit` 的 totalUsers | 离开超过 30 分钟后再次打开。同一时段里新开的标签页不算回访 |
| 比较率 | 比较人数 / 落地人数 | 本周各算各的，不是「先落地再比较」的严格先后 |
| 出站率 | 出站人数 / 比较人数 | 同上 |
| 回访率 | 回访人数 / 落地人数 | 回访发生在新的会话，不一定是本周落地的同一批人 |
| 出站后回访 | 回访查询里 `prior_outbound=yes` 的 totalUsers | 这台浏览器在更早的同意会话里点过出站，然后回来。不是账号级身份 |

页面拆分用 `page_group`（以及 GA4 自带的 `pagePath`）。渠道拆分用 `channel_type`（official / cloud / aggregator / reseller）和 `channel_slug`（供应商 slug）。来源拆分用 `traffic_channel` 和 `utm_source`。落地和出站还可以按 `utm_source` + `utm_campaign` 看人数。

`guide_slug` 只出现在 `funnel_landing`、`funnel_compare`、`funnel_outbound_click`。取值是已发布指南的 slug，当前为 `glm-chatglm-api-pricing`、`claude-anthropic-pricing`、`grok-pricing`、`kimi-api-pricing`、`openai-api-pricing`、`cursor-x-subscription-pricing`。事件发生的页面不是其中一篇指南时填 `(not set)`，包括指南目录页和比较页。不把落地指南带到后续页面。

`page_group` 取值：`home`、`api-pricing`、`model`、`provider`、`compare-models`、`compare-plans`、`compare-plan`、`compare-other`、`guide`、`coding-agents`、`other`。

`traffic_channel` 取值：`community`、`outreach`、`social`、`email`、`rss`、`paid`、`campaign`、`organic`、`referral`、`direct`。UTM 优先于引荐域名。引荐只保留主机名。

`compare_action` 取值：`view`、`add`、`remove`、`period_monthly`、`period_yearly`。

回访分桶：`gap_bucket` 为 `same_day`、`1d`、`2-7d`、`8-30d`、`31d+`；`prior_visits_bucket` 为 `1`、`2-4`、`5+`。日期按 UTC。

未打上渠道属性的外链（例如文档或工单）仍记出站，渠道为 `(not set)`，可用 `link_domain` 区分。

## 五条查询

`npm run report:funnel` 会打印下面五段的请求体。维度名里的 `customEvent:` 对应 GA4 里注册过的事件级自定义维度。

1. **阶段合计**：只有 `eventName`。这是周报开头的四个人数，不依赖自定义维度，事件一开始进 GA4 就能查。
2. **按页面 × 来源**：`eventName`、`page_group`、`traffic_channel`、`utm_source`。
3. **按页面 × 渠道**：`eventName`、`page_group`、`channel_type`、`channel_slug`。读出站时只保留 `funnel_outbound_click` 行。
4. **回访**：`eventName`、`gap_bucket`、`prior_visits_bucket`、`prior_outbound`。读回访时只保留 `funnel_return_visit` 行。
5. **按活动汇总落地和出站**：`eventName`、`utm_source`、`utm_campaign`。只含 `funnel_landing` 和 `funnel_outbound_click`，`totalUsers` 就是这两段的人数。

严格先后（同一次访问里落地 → 比较 → 出站）用 GA4 探索里的漏斗：步骤就是这三个事件名。回访跨会话，单独看第 4 条，不要塞进同一次会话漏斗。

## 注册自定义维度

在 GA4 管理 → 自定义定义 → 创建自定义维度，范围选**事件**，事件参数名与下面一致。注册不影响数据库，也不会回溯注册前的数据。阶段合计不依赖这一步；页面和渠道拆分依赖这一步。

`page_group`、`guide_slug`、`landing_page`、`traffic_channel`、`utm_source`、`utm_medium`、`utm_campaign`、`utm_content`、`referrer_host`、`channel_type`、`channel_slug`、`model_slug`、`link_domain`、`compare_type`、`compare_action`、`gap_bucket`、`prior_visits_bucket`、`prior_outbound`。

标准媒体资源的事件级自定义维度上限是 50 个。这里新增 18 个。`channel`（提醒的 email/rss）先不注册。
