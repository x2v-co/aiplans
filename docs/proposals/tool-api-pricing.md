# 按次计费的工具 API（Search / Fetch 等）入库方案

状态：提案，未改 schema。触发条目：DeepSeek Search / Fetch API（2026-10-16 上线）。

## 官方事实（2026-10-17 核实）

来源：https://api-docs.deepseek.com/zh-cn/guides/search 、https://api-docs.deepseek.com/zh-cn/quick_start/pricing

| API | Endpoint | 计费单位 | 价格 | 限速 |
| --- | --- | --- | --- | --- |
| Search | `POST https://api.deepseek.com/v1/tools/search` | 每 1,000 次成功请求 | ¥5 | 5 QPS / 账号 |
| Fetch | `POST https://api.deepseek.com/v1/tools/fetch` | 每 1,000 次成功请求 | ¥5 | 5 QPS / 账号，另有按目标域名的 QPS 限制 |

- 只有 HTTP 200 且有结果才计费（Search `results` 非空；Fetch 返回正文）。失败、无结果、超时不计费。`count`（1–50）不影响单价。
- Search 与 Fetch 各自独立限速；与模型并发限制无关；按账号计，与 API Key 无关。
- Claude Code Web Search / Codex `web_search` 发起的搜索，上线后前两周免 Search 费，结束时间官方“另行通知”。

## 现有 schema 能不能表示

结论：**不能干净地表示，先不入库。**

- `api_channel_prices` / `api_channel_price_variants`：价格列都是 `*_per_1m`（token），`price_unit` 虽可写别的值，但 API 定价页、排序、换算、audit 都按每百万 token 处理，塞进去会被当成 token 价比较。
- `usage_prices`（`price_kind` + `unit` + `price`）：字段上够用（如 `price_kind='request'`、`unit='per_1k_requests'`、`currency='CNY'`），但每行挂在 `models` 上，只被垂直模型页（video/music/world/decision/speech/image，由 `KIND_TO_CATEGORY` 决定）读取。Search/Fetch 不是模型；要入库只能伪造一个 `model_category='tool'` 的 models 行，而现在没有任何页面会展示它，audit 也不认识这个类别。
- `plans`：是订阅/套餐语义，不适合按次 API。

## 建议的扩展（需单独批准后实施）

1. 新表 `tool_api_prices`：
   - `provider_id`、`tool_slug`（`deepseek-search`、`deepseek-fetch`）、`tool_kind`（`web_search` | `web_fetch` | `code_exec` | `browser` …）、`endpoint`
   - `price`、`currency`、`unit`（`per_1k_requests` | `per_request` | `per_1k_results`）、`billable_condition`（例：`http_200_non_empty`）
   - `rate_limit_qps`、`rate_limit_scope`（`account` | `key` | `target_domain`）
   - `free_quota_note` / `promo_ends_at`（承接“前两周免费”这类优惠）
   - `source_url`、`last_verified`、`is_available`
2. 统一换算：页面把各家价格归一到“每 1,000 次 USD”（复用 `exchange_rates`），便于和 Tavily、Serper、Exa、Brave、Perplexity Search 等对比。
3. 新页面 `/tools/search`（或 API 定价页加“工具 API”分区），并让 audit 校验 `unit`/`currency` 白名单。
4. 首批 seed：DeepSeek Search、Fetch（带 dry-run），再补其他搜索 API。
5. 迁移通过 drizzle 生成，SRE 按常规先备份再执行。

在扩展落地前，DeepSeek Search / Fetch 保留在 backlog，不写进现有表。
