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
"${compose[@]}" build "${build_services[@]}"
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
"${compose[@]}" up -d --no-deps --remove-orphans app

for _ in {1..45}; do
  if curl -fsS "$health_url" >/dev/null; then
    echo "planprice rollout ok: $health_url"
    exit 0
  fi
  sleep 2
done

echo "planprice health check failed: $health_url" >&2
"${compose[@]}" ps >&2
"${compose[@]}" logs --tail=100 app >&2
exit 1
