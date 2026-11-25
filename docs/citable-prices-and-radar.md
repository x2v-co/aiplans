# 报价下载与同口径调价待审稿

第三方官方价格的再分发权利尚未经独立核验，本次实现不授予 CC0、MIT 或其他许可。公开 API 和实时导出保持空报价列表，JSON 与 CSV 都带有机器可读原因 `redistribution_scope_unpublished` 和中英文说明。下载不是完整的官方价目表。

## 数据与比较边界

- 现有官方/生产者变体表提供 `constraints_json`、变体与渠道备注、来源、公开/自助/合作伙伴标记和核验时间。提示词长度、处理模式、时间窗口与备注进入计费条件及比较标识。未知范围、未知可用性或折扣条件不进入报价或价格事件。
- 来源必须是经研究的 https 价格页面。首页和单独的 `providers.website` 不构成价格来源；`providers.type` 默认值本身不证明公开报价资格。实时路径拒绝示例域名。
- 只比较同一模型、渠道、币种、单位及计费条件。条件变化、零值、缺失、过期、未核验、新上架及版本替换均保留为未发出的原因。`replacement_model` 在退役模型上指向后继模型。
- `price_history` 原始记录只有单侧币种，缺少双侧单位、条件、来源和核验时间，仍为 `incomplete_history`。手工补充记录还必须分别提供 `previous_eligibility` 和 `current_eligibility` 的官方/公开/来源及范围元数据，通过与报价相同的检查。非示例历史仍因再分发范围未发布而禁止发布。
- 默认去噪阈值为 15%，可用 `--threshold` 修改。草稿没有自动发布功能。

## 本地示例命令

以下命令确实存在，不需要修改 `package.json`。示例文件中的 `fixture: true`、`not_market_data: true` 表示合成数据，不是市场价格。输出必须在 `public/` 之外。

```bash
env -u DATABASE_URL npx tsx scripts/export-citable-prices.ts --fixture --out /tmp/citable-current.json
env -u DATABASE_URL npx tsx scripts/export-citable-prices.ts --fixture --format csv --out /tmp/citable-current.csv
env -u DATABASE_URL npx tsx scripts/price-change-radar.ts --fixture --out /tmp/price-radar-fixture
env -u DATABASE_URL npx tsx scripts/price-change-radar.ts --fixture --baseline --out /tmp/price-radar-baseline
```

示例快照与待审稿中的行数及 +50% 变化只描述这些合成数据，不能当作市场证据。中英文待审稿明确标记不要发送。示例 JSON 原始行必须有 `fixture: true` 与 `not_market_data: true`，报价必须有已知的公开标记与已研究范围。

雷达同时接受原始 `rows` 包和下载的 `CitableSnapshot` JSON。下载输入会重新计算报价行摘要并核对 `snapshot_id`，摘要不符则报错。摘要是报价行校验值，不是对来源权威、整个信封或再分发权利的认证。两份文件的 `as_of` 可以不同；使用 `--as-of` 明确比较时钟（省略时使用当前文件的 `as_of`），按这个时钟检查新旧两侧的核验有效期。示例身份由 `sample_kind=synthetic_fixture` 保留；非示例输入不会获得许可或变成公开价格事件。

```bash
env -u DATABASE_URL npx tsx scripts/export-citable-prices.ts --fixture \
  --fixture-file scripts/fixtures/citable-radar/previous.json --out /tmp/citable-previous.json
env -u DATABASE_URL npx tsx scripts/price-change-radar.ts \
  --previous /tmp/citable-previous.json \
  --current /tmp/citable-current.json \
  --history scripts/fixtures/citable-radar/stock-history.json \
  --as-of 2026-11-01T00:00:00.000Z \
  --threshold 15 --max-age-days 30 --out /tmp/price-radar-downloads
```

还没有上一份样本时加 `--baseline`，只建立基线，不编造调价事件。CSV 带 UTF-8 BOM、以 `#` 开头的元数据行（包括 `snapshot_id`、示例身份、无许可与再分发说明、空导出原因），随后是报价表头。读取表格的工具可以跳过 `#` 行。公式防护仍适用于所有单元格。

## 公开接口

`/api/citable-prices?format=json` 和 `?format=csv` 当前只提供空报价信封，不读取数据库。带 `snapshot`、`history` 或 `date` 返回 404；这里不保留更早的快照。

`npx tsx scripts/export-citable-prices.ts --live --out /tmp/citable-unpublished.json` 同样只生成空信封，不连接数据库。它没有解除再分发限制的参数。生产或共享数据库、种子和实时价格抓取均不属于本工作流。
