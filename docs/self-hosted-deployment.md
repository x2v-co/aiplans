# Self-hosted deployment

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

The script runs both scraper groups and the read-only data audit. Audit exit
code 2 (warnings only) is accepted; critical findings still fail the job. It
uses the same `flock` lock as deployments, so a scraper cannot overlap either
the next hourly run or a release. A host cron entry can invoke it without
installing Node.js or browser packages on the VPS:

```cron
0 * * * * DOCKER_CMD="sudo -n docker" /opt/x2v/planprice/deploy/production/run-scrapers.sh >> /var/log/planprice-scraper.log 2>&1
```

Use a systemd service/timer instead when centralized journal logs and explicit
failure status are preferred. The current GitHub workflow can remain active
against the source database during preparation, but its schedule must be
disabled at final cutover to prevent two independent writers.

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
