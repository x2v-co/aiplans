# 火山方舟 Coding Plan Pro：API 标价估值补充

2026-11-05 · 有条件实测 · 非官方 · 低置信度。此补充只为已发布的 2026-10-28 数据增加公开标价估值，没有新增调用或测量。

## 来源与口径

- [三窗口报告](/reports/volcengine-three-windows-2026-10-28.md)及[逐次账本](/reports/volcengine-three-windows-2026-10-28.json)：30 次，响应模型均为 `kimi-k3`，普通输入 1,237,470，输出 21,228，无缓存读取或写入。约 98.31% 为普通输入。
- [Kimi 国际 API 官方页面](https://platform.kimi.ai/)与[定价文档](https://platform.kimi.ai/docs/pricing/chat)：`kimi-k3` 标准价为输入 $3、输出 $15 / 百万 tokens，2026-11-05 核验。采用实际响应模型的国际标准价作对照，不代表火山方舟的账单、余额或内部扣量价格，不套用 K3.1 Pro 或 Auto 路由价格。
- [火山方舟官方套餐价格](https://docs.volcengine.com/docs/ark/coding-plan-personal-new-user-promotion?lang=zh)：Pro 刊例价 ¥200/月，2026-11-05 核验。仓库已有 `seed/seed-pro`，见 `scripts/fix-plans-audit.ts`。不使用首购优惠价。
- 月费按固定展示假设 **¥6.90 / $1** 折合 **$28.9855/月**，与仓库 `src/lib/currency.ts` 的 `convertCurrency` 一致。这不是实时汇率；汇率变化会改变 USD 月费和倍数，不改变 USD API 估值。

## 计算

样本 API 估值 = (1,237,470 × 3 + 21,228 × 15) ÷ 1,000,000 = **$4.03083**。

每个窗口点估计 = $4.03083 × 100 ÷ **该窗口自身的已用比例增量**。区间按原报告 `roundingLow` / `roundingHigh` × $4.03083 ÷ 1,258,698 计算，保留原报告 tokens 舍入。

| 窗口 | 增量（百分点） | API 估值（USD，四舍五入） | 对应费用倍数 |
|---|---:|---:|---:|
| 5 小时 | 9.44 | $43（$43–43） | — |
| 周 | 1.26 | $320（$317–322） | 48.0× |
| 月（粗估） | 0.63 | $640（$630–650） | 22.1× |

周费 = 月费 ÷ 4.35；5 小时不计算月费倍数。月窗口独立测量，**不是周 × 4.35**。月信号较弱，沿用原报告的粗估标签。

区间仅含控制台读数舍入误差，不是统计置信区间。线性扣量、无其他账号流量等假设与原报告相同；未跨完整月周期验证。单模型、单负载结果不能推广为通用 token 上限；各窗口及多模型共用额度，容量不能相加。榜单只加入基准 `kimi-k3`，其他模型保留在[多模型报告](/reports/volcengine-models-2026-10-28.md)。

[估值来源与公式 JSON](/reports/volcengine-api-valuation-2026-11-05.json)

## English

Conditional measurement · unofficial · low confidence. This 2026-11-05 addendum values the existing 2026-10-28 ledger; no new measurements. The observed `kimi-k3` model uses Kimi international standard API list prices, verified on 2026-11-05: $3/M fresh input and $15/M output. This is a comparison value, not an Ark invoice or balance.

The 30-call sample has 1,237,470 fresh-input and 21,228 output tokens, with no cache reads/writes: **$4.03083** at list price. Each window uses its own measured percentage-point delta (9.44 / 1.26 / 0.63), giving about **$43 / $320 / $640** for five hours / week / month. Monthly is a native rough estimate, not a weekly projection. Bounds cover meter rounding only; the original report's other uncertainties still apply.

Pro costs CNY 200/month at the official standard price. The fixed display assumption CNY 6.90/USD matches the site's existing currency utility, giving about $29/month; this is not live FX. Monthly multiple is about 22.1×; weekly is about 48.0× using monthly fee ÷ 4.35. Five-hour windows have no fee multiple. Workloads remain in separate groups; shared model/window capacities cannot be added. Official sources and the original ledger are linked above.
