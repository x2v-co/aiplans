# 上线抽样验收清单

卡 `PVTI_lADOCjTjeM4Bmp6-zhBoNQ4`，需求 `reczz28OutRhFfyW`。

应用发布不再写目录。下面两段都要做：发布后确认页面还在、库没被这次发布改写；目录写入后确认页面上读库的字段和库一致，目录价也和 `usage_prices` 一致。

抽样不通过就停，不要接着改生产数据。记录目录在 `/opt/x2v/planprice/snapshots/seed-catalog/<时间>/`。

## 1. 应用发布之后（这次发布不应写目录）

发布日志里不能出现 `seed:vertical-models`、`seed:vertical-pricing`、`seed:vertical-logos`、`seed:vertical-benchmarks`、`seed:verified-creative-plans`、`audit:verticals:db`。

- [ ] `curl -fsSL https://aiplans.dev/api/health` 成功。
- [ ] 下面页面返回 200，正文不是空壳或整页加载中：
  - `https://aiplans.dev/zh/api-pricing`
  - `https://aiplans.dev/en/api-pricing`
  - `https://aiplans.dev/zh/plans`
  - `https://aiplans.dev/zh/video-models`
  - `https://aiplans.dev/zh/video-models/omnihuman-2-0`
  - `https://aiplans.dev/zh/providers/runway`
- [ ] `/zh/api-pricing` 抽一个本次 diff 没提到的模型。页面渠道价与 `api_channel_prices` 一致。目录 seed 不改这张表，发布也不该改它。
- [ ] 对比发布前。本次发布没有目录数据变更时，上述页面价格应与发布前相同。

## 2. 目录写入之后

只在 `seed-catalog.sh --apply`（或 Actions 里勾选写入）成功结束后做。写入前的记录必须齐：

- [ ] `meta.txt` 的 `mode` 是 `apply`，`git_sha` 是批准的那次代码。
- [ ] `diff.txt` 非空，里面是写入前的 dry-run，能看到 `旧值 → 新值` 或 `unchanged`。
- [ ] `backup.dump` 非空，文件头是 `PGDMP`。`backup.sha256` 与 `sha256sum backup.dump` 一致。
- [ ] `apply.txt` 里的写入顺序是 models →（无 slug 时）logos → pricing →（无 slug 时）verified creative plans → benchmarks → `audit:verticals:db`。
- [ ] `exit_code.txt` 为 `0`。`audit:verticals:db` 没有 CRITICAL。
- [ ] 有 slug 时，`diff.txt` 里有 `skip logos` 和 `skip verified creative plans and benchmarks`，并且 diff 里没有其他 slug 的更新行。

库查询在 VPS 上执行，不要把密码打进工单：

```bash
cd /opt/x2v/planprice
C="sudo -n docker compose -p planprice-production -f deploy/production/compose.yml --env-file deploy/production/.env.production"
$C exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1'
```

### 目录价：页面数字 = usage_prices

已审计的视频 / 音乐 / 决策页，标价来自随发布上线的目录代码。seed 把同一数字写入 `usage_prices`。两边必须相同。

| 页面 | 页面上应看到 | 库 |
|---|---|---|
| `/zh/video-models/omnihuman-2-0` 与 `/en/video-models/omnihuman-2-0` | OmniHuman 2.0，$0.07/秒 | `models.slug=omnihuman-2-0`，`name=OmniHuman 2.0`，`model_category=video`；`usage_prices` 中 `price_kind=video_second`、`unit=second`、`price=0.07`、`currency=USD` |
| `/zh/music-models/lyria-3-5` | Lyria 3.5，$0.08/首 | `price_kind=generation`、`unit=generation`、`price=0.08`、`currency=USD` |
| `/zh/decision-models/subq-snap` | SubQ Snap，输入 $0.05/1M，输出 $0 | `price_kind=input_tokens` 的 `price=0.05`；`price_kind=output_tokens` 的 `price=0` |

```sql
SELECT m.slug, m.name, m.model_category, u.price_kind, u.unit, u.price, u.currency
FROM models m
JOIN usage_prices u ON u.model_id = m.id
WHERE m.slug IN ('omnihuman-2-0', 'lyria-3-5', 'subq-snap')
ORDER BY m.slug, u.price_kind, u.unit;
```

### 页面直接读库的字段

- [ ] `/zh/providers/runway` 上 Runway Standard（yearly）月价 $12、年价 $144。对应 `plans.slug=runway-standard-yearly-verified`，`price=12`，`annual_price=144`，`currency=USD`。
- [ ] `/zh/video-models/sora` 上的榜单徽章来自库。页面百分比只保留 1 位小数：VBench 84.28 显示为 84.3%，VBench++ 58.38 显示为 58.4%。页面上每个徽章都要能对上查询结果里的一行。`sora` 同时有两条 `TOTAL_SCORE`，不要把 84.28 和 58.38 当成冲突。

```sql
SELECT slug, price, annual_price, currency
FROM plans
WHERE slug = 'runway-standard-yearly-verified';

SELECT b.slug, b.name, bm.name AS metric, s.value
FROM model_benchmark_scores s
JOIN models m ON m.id = s.model_id
JOIN benchmark_tasks bt ON bt.id = s.benchmark_task_id
JOIN benchmark_versions bv ON bv.id = bt.benchmark_version_id
JOIN benchmarks b ON b.id = bv.benchmark_id
JOIN benchmark_metrics bm ON bm.id = s.metric_id
WHERE m.slug = 'sora' AND bm.name = 'TOTAL_SCORE'
ORDER BY b.slug;
```

期望：`vbench` = 84.28，`vbench-plus` = 58.38。

### 只写了指定 slug 时

- [ ] diff 和 `apply.txt` 里只有该 slug。
- [ ] 再抽一个没写的 slug（例如没选 `lyria-3-5` 时看它）。页面和 `usage_prices.price` 与写入前一致。

## 3. 不通过时

用记录目录里的 `diff.txt`（旧值在箭头左侧）和 `backup.dump` 回看。`backup.dump` 是写入前这 10 张表的数据快照：`providers`、`models`、`plans`、`model_plan_mapping`、`usage_prices`、`benchmarks`、`benchmark_versions`、`benchmark_tasks`、`benchmark_metrics`、`model_benchmark_scores`。

不要对整库做 drop。其他表对外键依赖 `models`。回滚由 SRE 按 diff 里的旧值改回变更字段；新插入的行按 diff 里的 `create` / `➕` 删除。需要整表恢复时，先在备份上确认外键，再操作。
