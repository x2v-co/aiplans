# 调价雷达待审稿（不要发送）

> 示例数据，不是市场价格，不能当作事实引用。

- 状态：待审。不要发布，不要发送到飞书、邮件或外部平台。
- 去噪阈值：15%（可配置参数，用来减少草稿噪音）
- 比较时钟：2026-11-01T00:00:00.000Z
- 上一份可引用样本：sha256:ca5196fed125d5ca585dfa049f19fe04bc586beebb523046fbac5d4f57354cfd
- 当前可引用样本：sha256:dab3a8ab4abaec7c03f2918c86bef565b5d14da9682463b3638be522cb814e17
- 快照对比可发事件：1

## 可发事件

### Example Alpha (synthetic fixture) / Example Official

- 模型标识: `example-alpha`
- 渠道: `example-official`
- 币种 / 单位 / 条件: USD / per_1m_tokens / `scope={"channel_notes":null,"constraints":{"processing":"standard"},"kind":null,"variant":null,"variant_notes":null};input=quoted;output=quoted;cache=quoted;promo=none`
- 输入: 2 → 3 (+50%)
- 输出: 8 → 8 (0%)
- 缓存输入: 1 → 1 (0%)
- 来源（旧）: https://example.test/pricing/alpha
- 来源（新）: https://example.test/pricing/alpha
- 核验（旧）: 2026-10-20T00:00:00.000Z
- 核验（新）: 2026-10-20T00:00:00.000Z
- 本站引用: https://aiplans.dev/zh/models/example-alpha

## 未作为事件发出

- `example-beta / example-official / USD / per_1m_tokens / scope={"channel_notes":null,"constraints":{"processing":"standard"},"kind":null,"variant":null,"variant_notes":null};input=quoted;output=quoted;cache=missing;promo=none`: below_threshold (变化低于去噪阈值); max_abs_percent=10.00
- `example-delta / example-official / USD / per_1m_tokens / scope={"channel_notes":null,"constraints":{"processing":"standard"},"kind":null,"variant":null,"variant_notes":null};input=quoted;output=quoted;cache=missing;promo=none`: zero_value (出现零值，不能当作同口径调价)
- `example-epsilon / example-official`: missing_price (缺少可比较的输入或输出价格)
- `example-eta / example-official`: condition_changed (计费条件变了)
- `example-gamma / example-official`: unit_changed (计价单位变了)
- `example-iota / example-official`: not_in_current_rows (当前记录里没有这一行)
- `example-kappa-v2 / example-official`: version_replaced (模型版本被替换); example-kappa-v1 -> example-kappa-v2
- `example-nu / example-official`: new_listing (上一份里没有这个模型与渠道)
- `example-omicron / example-official / USD / per_1m_tokens / scope={"channel_notes":null,"constraints":{"processing":"standard"},"kind":null,"variant":null,"variant_notes":null};input=quoted;output=quoted;cache=missing;promo=none`: missing_source (缺少可核验的 https 来源)
- `example-pi / example-official / USD / per_1m_tokens / scope={"channel_notes":null,"constraints":{"processing":"standard"},"kind":null,"variant":null,"variant_notes":null};input=quoted;output=quoted;cache=missing;promo=none`: unverified (缺少核验时间)
- `example-theta / example-official / USD / per_1m_tokens / scope={"channel_notes":null,"constraints":{"processing":"standard"},"kind":null,"variant":null,"variant_notes":null};input=quoted;output=quoted;cache=missing;promo=none`: stale (核验时间早于有效窗口)
- `example-zeta / example-official`: currency_changed (币种变了)

## 未进入可引用样本

- invalid_source: 1
- missing_price: 1
- missing_source: 1
- non_official_channel: 2
- restricted_or_nonpublic: 1
- stale: 1
- unavailable: 1
- unverified: 1

## 价格历史日志

审阅 1 行。其中可单独成稿 0 行。现有 price_history 只保存一条币种和价格，没有新旧单位、计费条件、来源链接和两侧核验时间，这种行会记为 incomplete_history，不会变成事件。
历史日志没有可发事件。
- *: incomplete_history (历史行缺少同口径字段)
- incomplete_history: 1

同口径指同一模型标识、同一渠道、同一币种、同一计价单位和同一计费条件。缺失、零值、单位或币种变化、新上架、版本替换、过期或未核验，都不进入可发事件。

