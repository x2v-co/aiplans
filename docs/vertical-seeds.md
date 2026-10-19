# Vertical 目录 seed（models / pricing references）

`seed:vertical-models` 和 `seed:vertical-pricing` 默认 **dry-run**，只有显式 `--apply` 才写库。

- `--slug a,b`（或多次 `--slug x`）：只处理指定目录条目；未知 slug 直接报错退出。
- dry-run 逐字段输出 `字段: 旧值 → 新值`；没变的行显示 `unchanged`，`--apply` 时不写。
- `last_verified` 只往前走：库里日期更新就保留。
- `is_available`：只在新建行时写入；已有行要双向同步需显式加 `--sync-availability`（#221：seed 不改已有记录的可用状态）。例外只朝停用方向：目录状态为 `discontinued` 或 `retired` 时，已有用量行可以把 `is_available` 写成 `false`，不会改回 `true`。部署不带 `--sync-availability`。
- `deploy/production/rollout.sh` 每次发版显式带 `-- --apply`，现在只写真正变了的行。

## 生产手动执行（SRE）

环境文件路径是 `deploy/production/.env.production`（不是仓库根目录的 `.env.production`）。

```bash
cd /opt/x2v/planprice
C="sudo -n docker compose -p planprice-production -f deploy/production/compose.yml --env-file deploy/production/.env.production"
# 1) dry-run，逐字段 diff
$C run --rm --no-deps scraper npm run seed:vertical-models -- --slug omnihuman-2-0
$C run --rm --no-deps scraper npm run seed:vertical-pricing -- --slug omnihuman-2-0
# 2) 老板批准后写库
$C run --rm --no-deps scraper npm run seed:vertical-pricing -- --slug omnihuman-2-0 --apply
```
