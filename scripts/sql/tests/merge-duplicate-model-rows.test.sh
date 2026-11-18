#!/usr/bin/env bash
# Runs the 2026-11-18 duplicate-row merge against a throwaway local Postgres with
# synthetic rows for all pairs, plus the channel-conflict cases it must handle.
# Usage: scripts/sql/tests/merge-duplicate-model-rows.test.sh  (needs initdb/pg_ctl/psql;
# set PG_BIN, e.g. PG_BIN=/opt/homebrew/opt/postgresql@16/bin)
set -euo pipefail
SQL_FILE=scripts/sql/2026-11-18-merge-duplicate-model-rows.sql
BIN=${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1)}
D=$(mktemp -d); trap '"$BIN/pg_ctl" -D "$D/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$D"' EXIT
"$BIN/initdb" -D "$D/data" -U postgres >/dev/null
"$BIN/pg_ctl" -D "$D/data" -o "-k $D -p 55440 -c listen_addresses=''" -l "$D/log" start >/dev/null
PSQL=("$BIN/psql" -h "$D" -p 55440 -U postgres -v ON_ERROR_STOP=1 -qAt)

# Every pair in the script, read from its dup_targets INSERT.
PAIRS=$(sed -n '/^INSERT INTO dup_targets VALUES/,/;$/p' "$SQL_FILE" | grep -o "('[^']*', '[^']*')")

"${PSQL[@]}" <<SQL
CREATE TABLE models (id serial PRIMARY KEY, slug text UNIQUE NOT NULL, context_window int,
  max_output_tokens int, released_at date, description text, offical_link text,
  provider_ids int[] DEFAULT '{}', updated_at timestamptz);
CREATE TABLE api_channel_prices (id serial PRIMARY KEY, model_id int REFERENCES models(id),
  provider_id int, is_available boolean, last_verified timestamptz, updated_at timestamptz);
CREATE TABLE api_channel_price_variants (id serial PRIMARY KEY, model_id int REFERENCES models(id),
  provider_id int, variant_key text, is_headline boolean, is_available boolean, updated_at timestamptz,
  UNIQUE (provider_id, model_id, variant_key));
CREATE UNIQUE INDEX one_headline ON api_channel_price_variants (provider_id, model_id)
  WHERE is_headline AND is_available;
CREATE TABLE price_history (id serial PRIMARY KEY, channel_price_id int REFERENCES api_channel_prices(id));
CREATE TABLE model_plan_mapping (id serial PRIMARY KEY, model_id int REFERENCES models(id), plan_id int,
  UNIQUE (plan_id, model_id));
CREATE TABLE model_offical (id serial PRIMARY KEY, model_id int REFERENCES models(id));
CREATE TABLE model_benchmark_scores (id serial PRIMARY KEY, model_id int REFERENCES models(id));
CREATE TABLE evaluation_run (id serial PRIMARY KEY, model_id int REFERENCES models(id));
CREATE TABLE usage_prices (id serial PRIMARY KEY, model_id int REFERENCES models(id), updated_at timestamptz);
CREATE TABLE coding_agent_scores (id serial PRIMARY KEY, model_id int REFERENCES models(id), updated_at timestamptz);
CREATE TABLE external_price_references (id serial PRIMARY KEY, model_id int REFERENCES models(id), updated_at timestamptz);
CREATE TABLE model_slug_redirects (old_slug text PRIMARY KEY, model_id int REFERENCES models(id), reason text);

CREATE TEMP TABLE p(old_slug text, new_slug text);
INSERT INTO p VALUES $(echo "$PAIRS" | paste -sd, -);
INSERT INTO models (slug) SELECT new_slug FROM p;
INSERT INTO models (slug, context_window, provider_ids) SELECT old_slug, 128000, '{59}' FROM p;
-- An unrelated model must be untouched.
INSERT INTO models (slug) VALUES ('bystander');
INSERT INTO api_channel_prices (model_id, provider_id, is_available) SELECT id, 1, true FROM models WHERE slug = 'bystander';

-- Case A (disjoint providers): copy has OpenRouter, canonical has Azure + XycAi.
INSERT INTO api_channel_prices (model_id, provider_id, is_available, last_verified)
SELECT id, 59, true, now() FROM models WHERE slug = 'openai-gpt-4-1-mini';
INSERT INTO api_channel_prices (model_id, provider_id, is_available, last_verified)
SELECT id, pr, true, now() FROM models, unnest(ARRAY[10, 11]) pr WHERE slug = 'gpt-4.1-mini';
INSERT INTO api_channel_price_variants (model_id, provider_id, variant_key, is_headline, is_available)
SELECT id, 59, 'default', true, true FROM models WHERE slug = 'openai-gpt-4-1-mini';

-- Case B (shared provider, copy live, canonical stale): copy's channel survives.
INSERT INTO api_channel_prices (model_id, provider_id, is_available, last_verified)
SELECT id, 59, true, now() FROM models WHERE slug = 'openai-gpt-5-4';
INSERT INTO api_channel_prices (model_id, provider_id, is_available, last_verified)
SELECT id, 59, false, now() - interval '30 days' FROM models WHERE slug = 'gpt-5.4';
INSERT INTO price_history (channel_price_id)
SELECT c.id FROM api_channel_prices c JOIN models m ON m.id = c.model_id WHERE m.slug IN ('gpt-5.4', 'openai-gpt-5-4');
INSERT INTO api_channel_price_variants (model_id, provider_id, variant_key, is_headline, is_available)
SELECT id, 59, 'default', true, true FROM models WHERE slug IN ('gpt-5.4', 'openai-gpt-5-4');

-- Case C (shared provider, both live, canonical verified later): canonical's survives.
INSERT INTO api_channel_prices (model_id, provider_id, is_available, last_verified)
SELECT id, 59, true, now() - interval '2 days' FROM models WHERE slug = 'zai-glm-5-2';
INSERT INTO api_channel_prices (model_id, provider_id, is_available, last_verified)
SELECT id, 59, true, now() FROM models WHERE slug = 'glm-5.2';
INSERT INTO price_history (channel_price_id)
SELECT c.id FROM api_channel_prices c JOIN models m ON m.id = c.model_id WHERE m.slug = 'zai-glm-5-2';

-- Plan links (one conflicting), a benchmark score and a usage price on a copy.
INSERT INTO model_plan_mapping (model_id, plan_id) SELECT id, pl FROM models, unnest(ARRAY[1, 2]) pl WHERE slug = 'openai-gpt-4-1-mini';
INSERT INTO model_plan_mapping (model_id, plan_id) SELECT id, 1 FROM models WHERE slug = 'gpt-4.1-mini';
INSERT INTO model_benchmark_scores (model_id) SELECT id FROM models WHERE slug = 'openai-gpt-4-1-mini';
INSERT INTO usage_prices (model_id) SELECT id FROM models WHERE slug = 'openai-gpt-5-4';
SQL

OUT=$("${PSQL[@]}" -f "$SQL_FILE" -c "
SELECT 'MODELS', count(*) FROM models;
SELECT 'REDIRECTS', count(*) FROM model_slug_redirects r JOIN models m ON m.id = r.model_id;
SELECT 'CH', m.slug, string_agg(c.provider_id || ':' || c.is_available, ',' ORDER BY c.provider_id)
  FROM api_channel_prices c JOIN models m ON m.id = c.model_id
  WHERE m.slug IN ('gpt-4.1-mini', 'gpt-5.4', 'glm-5.2', 'bystander') GROUP BY m.slug ORDER BY m.slug;
SELECT 'HIST', m.slug, count(*) FROM price_history h JOIN api_channel_prices c ON c.id = h.channel_price_id
  JOIN models m ON m.id = c.model_id WHERE m.slug IN ('gpt-5.4', 'glm-5.2') GROUP BY m.slug ORDER BY m.slug;
SELECT 'VAR', m.slug, count(*) FROM api_channel_price_variants v JOIN models m ON m.id = v.model_id
  WHERE m.slug IN ('gpt-4.1-mini', 'gpt-5.4') GROUP BY m.slug ORDER BY m.slug;
SELECT 'PLANS', count(*) FROM model_plan_mapping mp JOIN models m ON m.id = mp.model_id WHERE m.slug = 'gpt-4.1-mini';
SELECT 'BENCH', count(*) FROM model_benchmark_scores b JOIN models m ON m.id = b.model_id WHERE m.slug = 'gpt-4.1-mini';
SELECT 'USAGE', count(*) FROM usage_prices u JOIN models m ON m.id = u.model_id WHERE m.slug = 'gpt-5.4';
SELECT 'CTX', context_window FROM models WHERE slug = 'gpt-4.1-mini';" 2>&1)
echo "$OUT" | grep -E '^(MODELS|REDIRECTS|CH|HIST|VAR|PLANS|BENCH|USAGE|CTX)\|'
N=$(echo "$PAIRS" | wc -l | tr -d ' ')
expect() { grep -qxF "$1" <<<"$OUT" || { echo "FAIL: missing '$1'"; exit 1; }; }
expect "MODELS|$((N + 1))"
expect "REDIRECTS|$N"
expect 'CH|bystander|1:true'
expect 'CH|gpt-4.1-mini|10:true,11:true,59:true'
expect 'CH|gpt-5.4|59:true'
expect 'CH|glm-5.2|59:true'
expect 'HIST|gpt-5.4|2'
expect 'HIST|glm-5.2|1'
expect 'VAR|gpt-4.1-mini|1'
expect 'VAR|gpt-5.4|1'
expect 'PLANS|2'
expect 'BENCH|1'
expect 'USAGE|1'
expect 'CTX|128000'

# A second run must refuse (copies are gone) and change nothing.
if "${PSQL[@]}" -f "$SQL_FILE" >/dev/null 2>"$D/err"; then echo "FAIL: second run succeeded"; exit 1; fi
grep -q 'Duplicate rows missing' "$D/err" || { echo "FAIL: unexpected error:"; cat "$D/err"; exit 1; }
echo "PASS ($N pairs)"
