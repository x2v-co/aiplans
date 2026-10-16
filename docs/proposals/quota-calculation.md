# 方案：购买不同套餐后可用额度的确定与计算

> 状态：方案草稿（仅文档，不含代码、迁移或数据写入）。核验日期：2026-10-16（UTC+8）。
> 标【未核验】的内容没有一手来源，落地前必须补证据；本文不引入任何未核验的数值。

## 0. 现状（已在 main 上的能力）

| 已有 | 位置 | 说明 |
| --- | --- | --- |
| 估算数据模型 [额度1] | `src/db/schema/quota.ts`，`drizzle/0005_quota_estimates.sql` | `usage_mixes`、`quota_estimates`（按 plan/served_model/window/mix 版本化，`est_tokens_low/high`、`confidence`、`verified_at`、`superseded_by`）、`quota_evidence`、`quota_text_snapshots` |
| 计算引擎 [额度2] | `src/lib/quota/engine.ts` | `blendedPricePerMTok`、`realUnitPrice`、`windowToWeekly`（5h/daily 必须显式给 `windowsPerWeek`）、`measuredQuota`（额度% 差 + 分项 token）、`applyMultiplier`（窗口不一致即报错）、`toRange` |
| 官方文案监测 [额度4] | `scripts/config/quota-text-sources.ts` | Claude、ChatGPT、Codex、Cursor、Copilot、GLM、Kimi、MiniMax、Qwen 等页面每日快照、变更告警 |
| 自测采集 [额度3，进行中] | `scripts/quota-collect.ts`，`quota_usage_samples`（0013） | codex-log、ccusage 等采集器，只存匿名 account_label |
| 社区证据 [额度5，等 SRE] | `drizzle/0012_quota_evidence_review.sql`，`npm run quota:evidence` | 社区证据最高 medium，永不 high |
| 按量标价 [额度6，等 SRE] | `src/lib/quota/pay-as-you-go.ts`，`npm run seed:quota-payg` | 用 `api_channel_prices` 标价 × 配比直接算 |
| 展示与历史 [额度7，完成] | provider/compare 页、`/[locale]/quota-changes` | 只显示 `verified_at` 非空的估算，区间两位有效数字 |
| 渠道条款字段（#123） | `drizzle/0008_channel_terms.sql` | `plans`/`api_channel_prices` 上的 `data_for_discount(+_note)`、`quota_unit ∈ {usd, requests, tokens, credits}` |

所以**缺的不是存储和引擎，而是一层“把各家额度规则翻译成同一单位”的规则描述**，以及让展示能同时说明“官方给了什么”和“我们换算成多少”。本方案只补这一层。

## 1. 各家额度模型（按计量方式分类）

| 类型 | 计量 | 窗口 | 例子（均为一手来源，核验 2026-10-16） | 可直接算吗 |
| --- | --- | --- | --- | --- |
| A. 美元额度（USD credit） | 美元，按供应商单价扣 | 计费周期 | Vercel Token Pass：$30/团队/月，含 $80 额度，按 Token Pass 供应商的每 token 单价扣，仅限 featured 模型（Kimi K3、GLM 5.3），用完 403、不超额计费、不结转。[docs](https://vercel.com/docs/ai-gateway/token-pass) / [billing](https://vercel.com/docs/ai-gateway/token-pass/billing) | 能，需该供应商单价 |
| B. 积分 + 公开抵扣系数 | 积分 = Σ token × 系数 | 5h + 周 | GLM Coding Plan：Lite/Pro/Max 每 5 小时 2,000/12,000/28,000 积分，每周 10,000/60,000/140,000；积分 =（输入×6.9 + 缓存命中×1.7 + 输出×24）/10000（GLM-5.3）；非高峰 50% 抵扣，高峰为工作日 14:00–18:00 UTC+8；仅限指定工具。[overview](https://docs.bigmodel.cn/cn/coding-plan/overview) | 能，完全公开 |
| C. 请求次数 × 模型倍率 | 次 × multiplier | 月 | Copilot Pro/Pro+（**仅限 2026-06-01 后仍留在旧版按请求计费的年付用户**）：300 / 1500 次 premium requests/月，超出 $0.04/次，每月 1 日 00:00 UTC 重置，代码审查一次扣 13 次，其他按模型倍率。[docs](https://docs.github.com/en/copilot/concepts/billing/copilot-requests) | 只能算“次数”，换 token 需每次请求的 token 量（自测） |
| D. 不透明 token 窗口（只给百分比进度条） | 未公开 | 5h + 周 | Claude Pro/Max：设置页显示 5 小时 session 与每周限额的已用百分比，不公布绝对值。[help](https://support.claude.com/en/articles/9797557-usage-limit-best-practices)；ChatGPT/Codex Plus：只给“每 5 小时本地消息数”区间（如 GPT-6.1 Sol 15–160），并说明“credit 价格不能决定订阅内额度”、Pro 目前无 5 小时限制、可能有周限。[codex pricing](https://developers.openai.com/codex/pricing/) | 不能，只能自测反推（`measuredQuota`） |
| E. 按量（PAYG） | 美元/MTok 标价 | 无 | `api_channel_prices` 已有渠道 | 能，[额度6] 已实现 |

【未核验】Cursor、Kimi Code、MiniMax、Qwen Coding Plan 的当前计量方式：页面已在每日监测，但本文没有逐条核对，落地时按上表 A–E 归类并补证据，不预设。
【未核验】Copilot 2026-06-01 之后新计费方式的额度口径：上面引用的是 legacy 页面，新方式需单独核验。

**倍率不连乘**：同一套餐里的模型倍率、快速模式倍率（例：Codex Fast 在订阅内 2.5x，[同上](https://developers.openai.com/codex/pricing/)）、高峰/非高峰系数都只在它声明的窗口里生效，沿用 `applyMultiplier` 的窗口校验。

## 2. 统一单位与公式

### 2.1 两个统一单位

1. **等价标价美元 EqUSD（主口径）**：这份额度如果改用该模型**官方按量标价**购买，值多少美元/月。
2. **等价百万 token EqMTok（展示口径）**：EqUSD ÷ 该模型在指定配比下的混合标价。直接复用现有 `usage_mixes`（`coding-high-cache` 97/2.5/0.5，`chat` 0/75/25；两者都是项目假设，不是厂商数据）。

为什么以 EqUSD 为主：它跨“次数 / 积分 / 美元 / token”都能定义，而且和 [额度6] 的按量基准同单位，用户可以直接对比“订阅 vs 自己按量付”。

### 2.2 公式

```text
blended(m, mix)   = (cached_in(m)×cache% + in(m)×in% + out(m)×out%) / 100      # USD/MTok，官方标价，engine.blendedPricePerMTok

每个约束窗口 w：
  EqMTok_w        = 窗口额度换算成 token（按类型，见下）
  EqMTok_month,w  = windowToWeekly(EqMTok_w, w, windowsPerWeek_w) × 4         # 1 月 = 4 周（沿用现有口径）

月可用 EqMTok     = min over w (EqMTok_month,w)                                 # 多个窗口同时生效，取最紧的那个
EqUSD             = 月可用 EqMTok × blended(m, mix)
标价倍数          = EqUSD / 月费                                                # 展示用：“约 N 倍标价”
真实单价          = engine.realUnitPrice(月费, 月可用 EqMTok×1e6)               # USD/MTok
```

各类型的 `EqMTok_w`：

| 类型 | EqMTok_w |
| --- | --- |
| A 美元额度 | credit_usd ÷ blended_provider(m, mix)，其中 blended_provider 用**额度扣费方**的单价；EqUSD 另用官方标价重算（两者不同就说明额度方单价比官方高或低） |
| B 积分 | credits_w ÷ (Σ 系数_k × mix_k%/100 /10000)，再按高峰/非高峰给出 [low, high] 两端 |
| C 次数 | requests_w ÷ multiplier(m) × 每次请求 token 中位数（**只能来自自测/社区**）；无此数据时只展示“次数”，不出 EqMTok |
| D 不透明 | `measuredQuota` 由额度% 变化和分项 token 反推 |
| E 按量 | 没有上限；展示“每 $1 ≈ 1/blended MTok”，或用户输入月预算 |

`windowsPerWeek` 对 5h 窗口必须显式选定并写进 notes（现有引擎强制）。本文建议展示两档：保守档 = 只看周限（多数套餐周限更紧时）；若某套餐无周限，则展示“每 5 小时额度”原值，月值标“未知”，与 [额度7] 现行做法一致。

### 2.3 算例（只用上文已核验的数）

**例 1：GLM Coding Plan Pro，GLM-5.3，coding-high-cache（97/2.5/0.5）**

```text
每 1M token 消耗积分 = (25,000×6.9 + 970,000×1.7 + 5,000×24) / 10,000
                    = (172,500 + 1,649,000 + 120,000) / 10,000 = 194.15 积分/MTok
周限 60,000 积分：高峰全价 60,000/194.15 ≈ 309 MTok/周；全部非高峰（0.5x）≈ 618 MTok/周
月（×4）：≈ 1,236 – 2,472 MTok  → 展示 “1.2B–2.5B tokens/月（估算）”
5h 限 12,000 积分 ≈ 62 MTok/5h（高峰）；要超过周限需 >5 个满窗口/周，故周限是约束
```

交叉验证：官方“可用额度参考”表给出缓存命中 96% 时 Pro 为 2.97–5.95 亿 tokens/周、98% 时 3.13–6.27 亿；我们 97% 的 3.09–6.18 亿落在两者之间，计算口径一致。
EqUSD = 1,236–2,472 × blended(GLM-5.3)。**GLM-5.3 官方按量标价本文未核验**，因此此处不给美元数；落地时从 `api_channel_prices` 读取（provider=zhipu，带 `last_verified`）。月费同样以 `plans` 表已核验的值为准。

**例 2：Vercel Token Pass**

```text
标价倍数（额度方口径）= $80 / $30 ≈ 2.67
EqMTok(GLM 5.3, mix)  = 80 / blended_TokenPass(GLM 5.3, mix)     # 单价见 Vercel 模型页，【未核验】
EqUSD(官方标价)        = EqMTok × blended_zhipu(GLM-5.3, mix)     # 【未核验】
```
只有 2.67 这个比值是一手数据；实际 token 量依赖 Token Pass 供应商单价，需在核验后入库。首个计费周期按剩余天数折算，展示时注明。

**例 3：Copilot Pro（legacy 按请求计费）**

```text
月额度 = 300 premium requests；超额 $0.04/次 → 厂商自己的边际价 = 300 × 0.04 = $12 等价
某模型倍率 x 时可用次数 = 300 / x（倍率表【未核验】，需引用官方 model multipliers 页）
EqMTok：需要“每次请求 token 中位数”（自测/社区），暂无 → 只展示次数
```

**例 4：Claude Pro/Max、ChatGPT Plus/Pro（类型 D）**
没有官方绝对值，全部依赖 [额度3] 的自测：一个窗口内记录额度% 前后读数（读数各 ±0.5pp）和分项 token，`measuredQuota` 给出 USD/1%，×100 得窗口 EqUSD，再换 EqMTok。没有通过审核的样本前，页面显示“暂无已核验的额度估算”，不展示任何数字。

**例 5：按量（PAYG）**：[额度6] 已实现，EqUSD = 用户实际花费；页面给“每 $1 ≈ X MTok（配比 Y）”。作为所有订阅的对照基线。

## 3. 数据来源与可信度

| 来源 | evidence_type（已有枚举） | 默认可信度 | 说明 |
| --- | --- | --- | --- |
| 官方给出绝对额度 + 公开换算规则（类型 A、B、E） | `official_absolute` | high | 只要单价也是官方核验值 |
| 官方给出绝对额度，但换算到 token 需要假设（类型 C） | `official_absolute` + `derived` | 次数 high，EqMTok medium/low | 两层分开存，次数本身可展示 |
| 官方只有描述性文案（类型 D 的消息数区间等） | `official_text` | low | 仅作参考说明，不进数值 |
| 自测（[额度3]） | `self_measured` | medium；同口径 ≥2 账号/≥3 个窗口一致可升 high【规则待老板定】 | 沿用 ±0.5pp 读数误差 |
| 社区（[额度5]） | `community` | low；两个独立来源中点差 ≤30% 可人工提为 medium | 永不 high（现有规则） |

展示不确定性：
- 只显示区间（两位有效数字）+ 数量级，并标“估算”；不写“便宜多少”“最低价”。
- 每条带：可信度徽章、核验日期（`verified_at`）、served model、配比、证据链接；`verified_at` 超过 30 天显示“待复核”【阈值待定】。
- 官方值与自测值冲突时两条都展示，不挑有利的。
- `data_for_discount = true` 的套餐旁加“以数据换折扣”提示（字段已存在）。

## 4. Schema、UI 与更新节奏

### 4.1 Schema（新增一张规则表，现有表不改语义）

新增 `quota_rules`（迁移编号顺延，手动迁移，不进 `migrate-data-accuracy.ts`，与 0005/0012 同流程）：

| 列 | 说明 |
| --- | --- |
| `plan_slug`, `plan_id` | 同 `quota_estimates` |
| `rule_kind` | `usd_credit` / `credits` / `requests` / `opaque` / `payg`（对应 A–E；与 `plans.quota_unit` 一致性由检查脚本校验） |
| `window` | `5h` / `daily` / `weekly` / `monthly` / `billing_period` |
| `amount` | 窗口额度数值（美元、积分或次数）；`opaque` 为空 |
| `served_model` | 可空；倍率/系数按模型分行 |
| `coef_input`, `coef_cached`, `coef_output`, `coef_divisor` | 积分类公开系数（GLM 为 6.9/1.7/24/10000） |
| `multiplier` | 次数类的模型倍率 |
| `time_factor_json` | 高峰/非高峰等时段系数（GLM：非高峰 0.5） |
| `charge_price_ref` | 美元额度按谁的单价扣（`api_channel_prices.id`） |
| `scope_note` | 限定工具、团队共享、首期折算等 |
| `evidence_id`, `verified_at`, `is_current`, `superseded_by` | 与 `quota_estimates` 相同的版本化 |

新增纯函数 `src/lib/quota/rules.ts`：`ruleToWindowTokens(rule, prices, mix)` → 再交给现有 `windowToWeekly` / `weeklyToMonthly`，产出写回 `quota_estimates`（`notes` 记录全部输入）。`quota_estimates` 仍是展示唯一来源；规则表只是“可复算的输入”。可选给 `quota_estimates` 加 `eq_usd_low/high` 冗余列，或展示时现算（倾向现算，避免汇率/标价更新后不一致）。

### 4.2 UI

- 套餐卡（[额度7] 已有区块）分两行：**官方额度**（原单位：“每周 60,000 积分”“300 次/月”“$80 额度/月”“未公布”）+ **我们的估算**（“≈1.2B–2.5B tokens/月 · coding 高缓存配比 · high · 2026-10-16 核验”）。
- 新增“标价倍数”列（EqUSD/月费，区间），同模型比价页可按它排序；未知的排最后，显示“未知”而不是 0。
- 配比切换（coding / chat），默认 coding。
- `/quota-changes` 历史页不变，规则变更也会产生新的估算版本，自然进入历史。

### 4.3 更新节奏

| 事件 | 动作 |
| --- | --- |
| 每日 | [额度4] 文案监测；变化 → 生成待审证据，不自动改规则 |
| 每日 | [额度3] 自测采集（本地），每周汇总一次进入审核 |
| 标价或汇率变化（`api_channel_prices.last_verified` 更新） | 重算 EqUSD/EqMTok（纯计算，生成新估算版本，dry-run → SRE apply） |
| 规则人工审核通过 | 新 `quota_rules` 版本 + 新估算版本 |
| 每月 | 超过 30 天未复核的条目列清单给 PM |

所有写库都走现有 dry-run / db-dry-run / apply，由 SRE 执行。

## 5. 与额度卡的对应与分阶段

| 阶段 | 内容 | 对应卡 | 需要老板 |
| --- | --- | --- | --- |
| P0（本 PR） | 方案文档 | — | 审阅本方案 |
| P1 | 类型 A/B/E：`quota_rules` 迁移 + `rules.ts` + GLM、Token Pass 入库，复用 [额度6] 的 PAYG 作为基线 | 扩展 [额度1][额度2][额度6] | 批准新开发卡；迁移上生产走 SRE 复选框 |
| P2 | 套餐卡“官方额度 / 估算 / 标价倍数”展示 | [额度7] | 走查 |
| P3 | 类型 C（Copilot 等）：次数直接展示；每次请求 token 量来自自测/社区 | [额度3][额度5] | — |
| P4 | 类型 D（Claude、ChatGPT/Codex）：自测样本 → `measuredQuota` → 审核后发布 | [额度3][额度5] | 升 high 的规则 |
| 不做 | 每月轮换购买套餐打满测试 | [额度8]（已拒） | — |

## 6. 需要老板定的问题

1. 主口径用 EqUSD（标价倍数）还是 EqMTok（tokens/月）？本文建议两者都展示，以“标价倍数”排序。
2. 5h 窗口的 `windowsPerWeek` 假设：只用周限作约束（保守），还是额外给一档“每天 N 个窗口”？
3. 自测升 high 的门槛（建议：≥2 个账号或 ≥3 个独立窗口，区间中点差 ≤30%）。
4. 待复核阈值：30 天？
5. 美元额度类（Token Pass）里，供应商单价高于官方标价时，是否在页面明确写出差额？
6. 是否需要 P1 新开一张开发卡（不复用已完成的 [额度1]/[额度2]）。

## 7. 来源（均于 2026-10-16 读取）

- Vercel Token Pass：https://vercel.com/docs/ai-gateway/token-pass ，https://vercel.com/docs/ai-gateway/token-pass/billing ，https://vercel.com/changelog/introducing-token-pass
- 智谱 GLM Coding Plan：https://docs.bigmodel.cn/cn/coding-plan/overview
- GitHub Copilot（legacy 请求计费）：https://docs.github.com/en/copilot/concepts/billing/copilot-requests
- OpenAI Codex pricing：https://developers.openai.com/codex/pricing/
- Claude 用量说明：https://support.claude.com/en/articles/9797557-usage-limit-best-practices
- 仓库内：`docs/quota-estimates.md`、`docs/quota-self-measure.md`、`src/lib/quota/*`、`src/db/schema/quota.ts`、`drizzle/0008_channel_terms.sql`、`scripts/config/quota-text-sources.ts`
