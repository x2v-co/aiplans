#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -- "$script_dir/../.." && pwd)"
compose_file="${COMPOSE_FILE:-$script_dir/compose.yml}"
env_file="${ENV_FILE:-$script_dir/.env.production}"
project_name="${COMPOSE_PROJECT_NAME:-planprice-production}"
host_app_port="${HOST_APP_PORT:-3000}"
health_url="${HEALTH_URL:-http://127.0.0.1:${host_app_port}/api/health}"
docker_cmd=(${DOCKER_CMD:-docker})

if [[ ! -f "$env_file" ]]; then
  echo "Missing $env_file. Create it from .env.production.template first." >&2
  exit 2
fi

if [[ ! -f "$compose_file" ]]; then
  echo "Missing $compose_file." >&2
  exit 2
fi

export APP_ENV_FILE="$env_file"
export HOST_APP_PORT="$host_app_port"

compose=("${docker_cmd[@]}" compose -p "$project_name" -f "$compose_file" --env-file "$env_file")

cd "$repo_root"
"${compose[@]}" config --quiet
build_services=(app migrate)
if [[ "${BUILD_SCRAPER:-0}" == "1" ]]; then
  build_services+=(scraper)
fi
# Keep code and images consistent: snapshot the currently deployed image tags
# before building. If anything fails before the new app is confirmed healthy,
# restore the previous tags so timers (scraper) and the app keep running the
# images that match the still-deployed code. The workflow only syncs the new
# code into the stable path after this script exits 0.
image_name() { echo "${project_name}-$1:latest"; }
rollback_tag() { echo "${project_name}-$1:pre-rollout"; }
snapshotted=()
for svc in "${build_services[@]}"; do
  if "${docker_cmd[@]}" image inspect "$(image_name "$svc")" >/dev/null 2>&1; then
    "${docker_cmd[@]}" tag "$(image_name "$svc")" "$(rollback_tag "$svc")"
    snapshotted+=("$svc")
  fi
done
restore_images() {
  local rc=$?
  trap - ERR EXIT
  if [[ "$rc" != "0" ]]; then
    echo "rollout failed (exit $rc); restoring previous images" >&2
    for svc in "${snapshotted[@]}"; do
      "${docker_cmd[@]}" tag "$(rollback_tag "$svc")" "$(image_name "$svc")" || true
    done
    if [[ "${app_switched:-0}" == "1" ]]; then
      "${compose[@]}" up -d --no-deps app || true
    fi
  fi
  exit "$rc"
}
trap restore_images EXIT

# Disk hygiene after a healthy rollout. Each project image keeps exactly two
# tags: :latest (running) and :pre-rollout (the one previous release, the
# rollback target). The older :pre-rollout that was just re-pointed becomes
# dangling, and so do stray tags left by manual builds; remove both. Images in
# use by a container are skipped by docker itself. Never fails the rollout.
prune_superseded_images() {
  local ref
  "${docker_cmd[@]}" image ls --format '{{.Repository}}:{{.Tag}}' 2>/dev/null \
    | grep -E "^${project_name}-[a-z0-9_-]+:" \
    | grep -vE ':(latest|pre-rollout|<none>)$' \
    | while IFS= read -r ref; do
        echo "disk-hygiene: removing stale image tag $ref"
        "${docker_cmd[@]}" image rm "$ref" >/dev/null 2>&1 || true
      done || true
  "${docker_cmd[@]}" image prune -f >/dev/null 2>&1 || true
  echo "disk-hygiene: kept images:"
  "${docker_cmd[@]}" image ls --format '{{.Repository}}:{{.Tag}} {{.Size}}' 2>/dev/null \
    | grep -E "^${project_name}-" || true
}

"${compose[@]}" build "${build_services[@]}"
"${compose[@]}" run --rm --no-deps scraper npm run validate:production-env
"${compose[@]}" up -d postgres

database_ready=0
for _ in {1..30}; do
  if "${compose[@]}" exec -T postgres \
    sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; then
    database_ready=1
    break
  fi
  sleep 2
done

if [[ "$database_ready" != "1" ]]; then
  echo "PostgreSQL did not become ready." >&2
  "${compose[@]}" ps >&2
  exit 1
fi

"${compose[@]}" run --rm --no-deps migrate
"${compose[@]}" run --rm --no-deps scraper npm run seed:vertical-models -- --apply
"${compose[@]}" run --rm --no-deps scraper npm run seed:vertical-logos
"${compose[@]}" run --rm --no-deps scraper npm run seed:vertical-pricing -- --apply
"${compose[@]}" run --rm --no-deps scraper npm run seed:verified-creative-plans
"${compose[@]}" run --rm --no-deps scraper npm run seed:vertical-benchmarks
"${compose[@]}" run --rm --no-deps scraper npm run audit:verticals:db
"${compose[@]}" run --rm --no-deps scraper npm run refresh:fx
"${compose[@]}" run --rm --no-deps scraper npm run publish:v1
app_switched=1
"${compose[@]}" up -d --no-deps --remove-orphans app

for _ in {1..45}; do
  if curl -fsS "$health_url" >/dev/null; then
    # The GitHub runner invokes this script as root from the stable production
    # path. Install the retention timer here as well as in the workflow's
    # post-rollout step so the policy survives a rollout even when a runner
    # has an older workflow checkout.
    if { [[ "$script_dir" == /opt/x2v/planprice/deploy/production ]] ||
         [[ "$script_dir" == /opt/x2v/planprice/.releases/*/deploy/production ]]; } \
      && [[ -d /run/systemd/system ]] && command -v systemctl >/dev/null 2>&1; then
      install -m 0644 "$script_dir/planprice-snapshot-cleanup.service" /etc/systemd/system/planprice-snapshot-cleanup.service
      bash "$script_dir/install-timers.sh" "$script_dir" planprice-snapshot-cleanup.timer
    fi
    prune_superseded_images
    echo "planprice rollout ok: $health_url"
    exit 0
  fi
  sleep 2
done

echo "planprice health check failed: $health_url" >&2
"${compose[@]}" ps >&2
"${compose[@]}" logs --tail=100 app >&2
exit 1
