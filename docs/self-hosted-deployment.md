# Self-hosted deployment

完整组件关系和发布顺序见 [`production-deployment-map.md`](./production-deployment-map.md)。

planprice runs as an independent Docker Compose project beside toolkit on the
same VPS. It owns its PostgreSQL volume and binds Next.js only to
`127.0.0.1:3000`. The shared `x2v-gateway` project owns the public Cloudflare
Tunnel and Nginx routing; neither application Compose project manages it.

```text
Cloudflare Tunnel -> x2v-gateway Nginx :127.0.0.1:18080
├── toolkit.fun  -> 127.0.0.1:5002
└── aiplans.dev  -> 127.0.0.1:3000

toolkit Compose project
└── app + worker + MongoDB + Redis

planprice-production Compose project
└── Next.js + PostgreSQL + on-demand scraper/migration containers
```

## Server checkout

Keep the repository checkout and its deployment files together so the Compose
build context resolves correctly:

```text
/opt/x2v/planprice/
├── Dockerfile
├── package.json
└── deploy/production/
    ├── compose.yml
    ├── rollout.sh
    ├── run-scrapers.sh
    └── .env.production
```

Create the environment file on the VPS and do not commit it:

```bash
cd /opt/x2v/planprice
cp deploy/production/.env.production.template deploy/production/.env.production
chmod 600 deploy/production/.env.production
```

Set a long random `POSTGRES_PASSWORD`. The database is available only on the
private Compose network; only the app port is bound to the host loopback
interface.

Before rollout, validate the production environment from the same shell that
will run Compose:

```bash
set -a; . deploy/production/.env.production; set +a
npm run validate:production-env
```

The public catalog deployment must set `PLANPRICE_SERVICE_ROLE=public`,
`PLANPRICE_CATALOG_TOKEN`, and no `EXCHANGE_RATE_API_KEY`. The separate admin
deployment sets `PLANPRICE_SERVICE_ROLE=admin`, `PLANPRICE_ADMIN_HOST`, and its
own exchange-rate key. Never copy the admin key into the public app environment.
The snapshot directory is mounted from `/opt/x2v/planprice/snapshots`; the
publisher writes `current.json`, immutable versioned snapshots, and
`exchange-rates.json` there.

## Database cutover

The initial PostgreSQL container needs a full copy of the current database.
Use the source database's direct PostgreSQL connection on port 5432 rather than
its transaction-pooler endpoint.

1. Pause scraper and other database-writing jobs.
2. Export the current database from a trusted machine:

   ```bash
   pg_dump "$SOURCE_DATABASE_URL" \
     --format=custom --no-owner --no-acl \
     --file=planprice.dump
   ```

3. Transfer `planprice.dump` to a restricted backup directory on the VPS.
4. Start the new, empty PostgreSQL service and restore the dump:

   ```bash
   cd /opt/x2v/planprice
   docker compose -p planprice-production \
     -f deploy/production/compose.yml \
     --env-file deploy/production/.env.production \
     up -d postgres

   docker compose -p planprice-production \
     -f deploy/production/compose.yml \
     --env-file deploy/production/.env.production \
     exec -T postgres pg_restore \
       --username planprice --dbname planprice \
       --no-owner --no-acl < /opt/x2v/backups/planprice.dump
   ```

5. Run the rollout. It applies the idempotent application migrations before
   replacing the app container:

   ```bash
   DOCKER_CMD="sudo -n docker" deploy/production/rollout.sh
   ```

6. Check `/api/health`, key read pages, and one disposable write path. Disable
   the GitHub-hosted scheduled scraper, install the VPS-local scraper schedule
   described below, and then resume database writes.

Do not allow writes to both databases after the final dump. Keep the source
database read-only for a short rollback window instead of deleting it during
the cutover.

## Releases

`deploy/production/rollout.sh` performs only planprice operations:

- validates the Compose configuration;
- builds the app and migration images (set `BUILD_SCRAPER=1` when the scraper
  image also needs rebuilding);
- starts/waits for planprice PostgreSQL;
- runs the idempotent schema migrations;
- does not seed the vertical catalog (that write is `deploy/production/seed-catalog.sh`; see `docs/vertical-seeds.md`);
- replaces only the planprice app container;
- waits for `http://127.0.0.1:3000/api/health`.

It does not reload Nginx, restart toolkit containers, or prune global Docker
resources. The Compose project name and host ports are distinct from toolkit,
so normal application releases do not restart one another. Runtime limits cap
planprice at 2 GB for Next.js, 3 GB for PostgreSQL, and 3 GB for a scraper run;
these are conservative defaults for the shared 4-core/16-GB host.

### GitHub Actions deployment

`.github/workflows/deploy-production.yml` deploys every code push to `main`
after `npm ci` and a production build pass. Lint currently remains visible but
non-blocking until the repository's existing lint backlog is cleared. The deploy job runs on the
dedicated `planprice-production-devbox` self-hosted runner, expands a
`git archive` into an isolated release directory, runs the existing rollout
script, and only then syncs the release into the checkout used by the scraper
timer. The workflow never restarts toolkit or `x2v-gateway` and does not run
global Docker cleanup.

Create a GitHub Environment named `Production`. The optional configuration
values are:

```text
Variable DEPLOY_PATH       /opt/x2v/planprice
Variable NEXT_PUBLIC_GA_ID      optional GA measurement ID
```

The runner service executes as `ubuntu` and requires passwordless `sudo` for
Docker, `rsync`, archive extraction, and the planprice release path. Keep the
production PostgreSQL environment file on the VPS; it is explicitly excluded
from the release archive.

Before a schema-changing production release, create a database backup:

```bash
mkdir -p /opt/x2v/backups
docker compose -p planprice-production \
  -f deploy/production/compose.yml \
  --env-file deploy/production/.env.production \
  exec -T postgres pg_dump \
    --username planprice --dbname planprice --format=custom \
  > /opt/x2v/backups/planprice-$(date +%Y%m%d-%H%M%S).dump
```

Rollback means checking out the previous application revision and running the
same rollout script. Database rollback is separate and should use the backup
only when the release made an incompatible schema/data change.

## Scheduled scrapers

Do not expose PostgreSQL publicly just so a GitHub-hosted runner can reach it.
The `scraper` Compose profile contains the Node.js dependencies and Chromium,
and connects to PostgreSQL over the private Compose network. Run both scraper
groups with:

```bash
DOCKER_CMD="sudo -n docker" /opt/x2v/planprice/deploy/production/run-scrapers.sh
```

The API pricing timer runs six times daily at 01:15, 05:15, 09:15, 13:15,
17:15 and 21:15 Asia/Singapore, with up to 10 minutes of randomized delay.
The full script runs once daily and refreshes API prices, subscription plans, and the live Chatbot Arena
Agent leaderboard, then runs the read-only data audit. Arena outages are logged as a
warning and preserve the last successful ranking; audit exit code 2 (warnings
only) is accepted. It uses the same `flock` lock as deployments, so a scraper
cannot overlap either the next daily run or a release. The production GitHub
Actions deployment installs and enables the checked-in systemd units. The timer
runs daily at 03:15 Asia/Singapore with up to 15 minutes of randomized delay.
Each run refreshes USD FX from Frankfurter before scraping and republishes the
current v1 catalog snapshot after deployment; a failed FX refresh leaves the
previous rates in place and is reported in the scraper log.
The scraper run publishes v1 whenever the API scrape succeeds, even if the data
audit reports critical findings. The audit summary is logged after publication,
and critical findings still fail the job so OnFailure alerts fire.
The deployment also installs `planprice-snapshot-cleanup.timer`, which runs
daily at 04:15 Asia/Singapore and removes immutable v1 snapshots only after
their 90-day retention window. `current.json` and unreadable snapshots are
retained for audit.
A host cron entry can provide an equivalent fallback without installing Node.js
or browser packages on the VPS:

```cron
15 3 * * * DOCKER_CMD="sudo -n docker" /opt/x2v/planprice/deploy/production/run-scrapers.sh >> /var/log/planprice-scraper.log 2>&1
```

The GitHub-hosted scraper workflow is manual recovery only, preventing two
independent scheduled writers.

Check freshness without consuming GitHub Actions minutes:

```bash
npm run scrape:status
```

The command reads the public exchange-rate timestamp and exits non-zero when
the data is older than `PLANPRICE_MAX_RATE_AGE_HOURS` (default 30 hours).


## Disk hygiene (build cache)

Planprice production builds on the self-hosted `planprice-production` runner
leave Docker builder cache on the host root filesystem. The `deploy-production`
workflow always runs non-fatal hygiene after the rollout step (`if: always()`,
`continue-on-error: true`), including when the rollout itself failed — failed
deploys used to skip prune and fill the disk:

```bash
docker builder prune -f --filter until=72h --keep-storage 8GB
docker image prune -f   # dangling only; keeps tagged :latest and :pre-rollout
```

(`df -h /` logged around each prune). Never `image prune -a`: `rollout.sh`
tags the previous images as `:pre-rollout` for rollback and needs them kept.

After IndexNow (or after a failed earlier step), the workflow also starts the
host one-shot when it is installed:

```bash
sudo systemctl start planprice-disk-guard.service
```

Unit/timer templates are checked in; install is still SRE-owned (not enabled
by deploy). Timer cadence is SRE-owned — raise frequency there if usage still
climbs between deploys:

- `deploy/production/planprice-disk-guard` — builder prune (72h / keep 8GB) +
  dangling `docker image prune -f` only. Never prunes volumes, never
  `image prune -a`, never force-removes images used by containers.
- `deploy/production/planprice-disk-guard.service`
- `deploy/production/planprice-disk-guard.timer` — daily 05:45 Asia/Singapore

SRE install (once, on x2v-global / planprice host):

```bash
# After a deploy has rsynced templates to /opt/x2v/planprice:
sudo cp /opt/x2v/planprice/deploy/production/planprice-disk-guard.service \
  /opt/x2v/planprice/deploy/production/planprice-disk-guard.timer \
  /etc/systemd/system/
sudo chmod 0755 /opt/x2v/planprice/deploy/production/planprice-disk-guard
sudo systemctl daemon-reload
# Manual once before enabling the timer:
sudo systemctl start planprice-disk-guard.service
journalctl -u planprice-disk-guard -n 80 --no-pager
df -h /
sudo systemctl enable --now planprice-disk-guard.timer
systemctl list-timers planprice-disk-guard.timer
```

## Gateway ownership

Manage the shared gateway in `/opt/x2v/x2v-gateway`. Keep routing changes in
that infrastructure repository and deploy them with its validation/reload
sequence:

```bash
cd /opt/x2v/x2v-gateway
DOCKER_CMD='sudo -n docker' ./scripts/rollout.sh
```

The planprice Compose project should only replace the planprice app and
PostgreSQL containers. It must not restart toolkit or the shared gateway.

Application workflows must not restart the shared Nginx service. A toolkit
release should only replace toolkit containers; a planprice release should
only replace planprice containers. Gateway changes should be reviewed and
released separately, because an invalid shared routing configuration affects
both sites. `deploy/nginx/aiplans.dev.conf.example` is retained as historical
reference only and is not installed on the VPS.

## 暂停定时任务（部署会尊重）

`deploy-production.yml` 和 `rollout.sh` 在安装/启用 timer 前会检查暂停状态，满足任一条件即跳过该 timer 的 install、enable、restart，并在日志里打印 `⏸️ ... skipping`：

1. timer 被 mask（推荐）：
   ```bash
   sudo systemctl stop planprice-api-scraper.timer
   sudo systemctl mask planprice-api-scraper.timer
   ```
2. 或存在标记文件：
   ```bash
   sudo mkdir -p /etc/planprice/paused-timers
   echo "paused 2026-10-15, approved by owner" | sudo tee /etc/planprice/paused-timers/planprice-api-scraper.timer
   sudo systemctl disable --now planprice-api-scraper.timer
   ```
   （标记只阻止部署重新打开，当前正在跑的 timer 仍需 `disable --now`。）

恢复：`sudo systemctl unmask <timer>` 或删除标记文件，然后重新部署或手动 `systemctl enable --now <timer>`。
