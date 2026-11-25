# 可引用报价与调价雷达草稿

这是给运营和审稿用的本地闭环。它不发布文章，不发飞书，不写生产库，也不把第三方报价声明成可再分发的数据集。

## 已经有的能力

- `/zh/reports/api-price-index` 和 `/en/reports/api-price-index` 展示本站当前读到的模型、渠道和价格历史。页面上的数字随请求计算，不是固定的模型数或渠道数。
- `price_history` 在抓取时记下输入价和输出价。一行里只有一个币种，没有新旧计价单位、计费条件、来源链接和两侧核验时间。
- `npm run publish:v1` 生成带 sha256 的内部目录快照，走需要授权的 `/api/v1`，不是公开引用文件。
- 只读审计 `npm run audit` 会标出零值、倒挂、过期和异常价格。过期窗口默认 30 天。

## 这次补上的部分

1. 公开下载只保留官方或生产者渠道、带 https 来源、并且核验时间落在窗口内的标价。字段包括模型标识、渠道、币种、计价单位、输入/输出、缓存、促销与促销后常规价、缺失标记、来源和核验时间。`snapshot_id` 是这些报价行的 sha256，同一批报价重复导出得到同一个值。这个入口不保留更早的快照。
2. `npm run radar:drafts` 只比较同一模型标识、同一渠道、同一币种、同一计价单位和同一计费条件。15% 是默认去噪参数，可以用 `--threshold` 改。缺失、零值、单位或币种变化、新上架、版本替换、过期和未核验都不会变成可发事件。

聚合、转售、云市场和基准数据仍然留在站内比较页，不进入下载。条款没有把这些价格授成 CC0 或 MIT，所以文件里写明不授予再分发许可。

## 运营怎么跑

示例数据在 `scripts/fixtures/citable-radar/`。它们标了 `fixture: true` 和 `not_market_data: true`，价格是假的。

```bash
npx tsx scripts/export-citable-prices.ts --fixture
npx tsx scripts/price-change-radar.ts
```

第二条命令会把中英文待审稿写到 `docs/examples/price-change-radar/`。示例结果是：当前可引用样本 8 行，快照对比只有 `example-alpha` 的 +50% 输入价变化，价格历史样例行因为字段不全而没有事件。没有改 `package.json`，避免碰已经钉住的部署脚本清单。

换成自己的两份原始 JSON 时，两份文件的 `as_of` 必须相同。文件如果标了 `fixture: true`，还必须标 `not_market_data: true`。

```bash
npx tsx scripts/price-change-radar.ts \
  --previous previous.json \
  --current current.json \
  --history history.json \
  --threshold 15 \
  --max-age-days 30 \
  --out /tmp/price-radar
```

还没有上一份样本时，加 `--baseline`。命令会记下当前样本，并写明没有可发事件。不要手写价格变化。

线上 JSON/CSV 在 `/api/citable-prices?format=json` 和 `?format=csv`。带 `snapshot`、`history` 或 `date` 会返回 404，因为这里没有历史快照。数据库读失败时返回 503 和空列表，不会补一份假报价。

只有同时具备 `DATABASE_URL` 和 `--live --confirm-read-only` 时，导出命令才会读数据库，而且只读。这次没有跑这条命令，也没有连接生产库。

审稿通过之前，不要把草稿发出去，也不要把示例文件放进 `public/`。命令拒绝写入 `public/`。
