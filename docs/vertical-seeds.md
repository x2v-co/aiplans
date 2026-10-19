# Vertical 目录 seed（models / pricing references）

`seed:vertical-models` 和 `seed:vertical-pricing` 默认 **dry-run**，只有显式 `--apply` 才写库。

- `--slug a,b`（或多次 `--slug x`）：只处理指定目录条目；未知 slug 直接报错退出。
- dry-run 逐字段输出 `字段: 旧值 → 新值`；没变的行显示 `unchanged`，`--apply` 时不写。
- `last_verified` 只往前走：库里日期更新就保留。
- `is_available`：只在新建行时写入；已有行要双向同步需显式加 `--sync-availability`（#221：seed 不改已有记录的可用状态）。例外只朝停用方向：目录状态为 `discontinued` 或 `retired`，或模型 `shutdown_date`（UTC，当天起）已到时，已有用量行可以把 `is_available` 写成 `false`，不会改回 `true`；`audit:verticals:db` 按同一规则判定。手动写入默认不带 `--sync-availability`。
- 应用发布（`deploy/production/rollout.sh` 和 Deploy Planprice Production）**不跑**这些 seed。写入走下面的手动流程。
- 关停日扫尾 `seed:shutdown-availability`（默认 dry-run，`--apply` 写，`--check` 只读审计）：已到 `shutdown_date`（UTC，当天起）的模型，其 `api_channel_prices` / `api_channel_price_variants` 只从可用改为 `is_available=false`，并置 `availability_locked=true`。只停不开。它跑在两处：每天的 `planprice-scraper`（`run-scrapers.sh`，抓价之后）和手动 `seed-catalog.sh`（dry-run 进 diff，apply 在审计前，之后跑 `audit:shutdown-availability`）。应用发布不跑。
- `availability_locked=true` 且 `is_available=false`：人工/seed 下架（discontinued、retired、过关停日）。抓价 upsert 仍可刷新价格，但不会把它改回可用；要恢复需显式 SQL 清掉锁。

## 生产手动执行（SRE）

脚本：`deploy/production/seed-catalog.sh`。也可以在 GitHub Actions 手动跑 **Seed catalog data**（`workflow_dispatch`，默认不写库）。

环境文件路径是 `deploy/production/.env.production`（不是仓库根目录的 `.env.production`）。脚本只存在于含这次拆分的发布同步到 `/opt/x2v/planprice` 之后。

```bash
cd /opt/x2v/planprice
# 1) dry-run。diff 在 snapshots/seed-catalog/<时间>/diff.txt
sudo -n env DOCKER_CMD=/usr/bin/docker LOCK_PATH=/opt/x2v/planprice \
  deploy/production/seed-catalog.sh --slug omnihuman-2-0
# 2) 老板批准 diff 后再写。脚本会先 pg_dump，再 --apply
sudo -n env DOCKER_CMD=/usr/bin/docker LOCK_PATH=/opt/x2v/planprice \
  deploy/production/seed-catalog.sh --apply
```

`--slug` 只缩小 models 和 pricing。logo、已核实创作套餐、benchmark 不能按 slug 缩小，带 `--slug` 时会跳过。全目录写入不要加 `--slug`。

每次 `--apply` 的记录目录：

| 文件 | 内容 |
|---|---|
| `diff.txt` | 写入前的 dry-run |
| `backup.dump` | 写入前 10 张目录相关表的 `pg_dump` custom 数据快照，文件头 `PGDMP` |
| `backup.sha256` | 上述文件的校验 |
| `apply.txt` | 实际写入和 `audit:verticals:db` 输出 |
| `meta.txt` / `exit_code.txt` | 模式、slug、git sha、退出码 |

上线后按 [launch-sample-checklist.md](./launch-sample-checklist.md) 抽样。页面与库不一致就停，不要在同一轮里再写一次。
