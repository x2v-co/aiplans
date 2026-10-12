#!/usr/bin/env bash
# Runs the dedupe script against a throwaway local Postgres with synthetic data.
# Usage: scripts/sql/tests/dedupe-price-history.test.sh  (needs initdb/pg_ctl/psql)
set -euo pipefail
BIN=${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin | tail -1)}
D=$(mktemp -d); trap '"$BIN/pg_ctl" -D "$D/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$D"' EXIT
"$BIN/initdb" -D "$D/data" -U postgres >/dev/null
"$BIN/pg_ctl" -D "$D/data" -o "-k $D -p 55439 -c listen_addresses=''" -l "$D/log" start >/dev/null
PSQL=(psql -h "$D" -p 55439 -U postgres -v ON_ERROR_STOP=1 -qAt)
"${PSQL[@]}" <<'SQL'
CREATE TABLE providers (id int PRIMARY KEY, slug text);
CREATE TABLE models (id int PRIMARY KEY, slug text);
CREATE TABLE api_channel_prices (id int PRIMARY KEY, model_id int, provider_id int,
  input_price_per_1m numeric, output_price_per_1m numeric);
CREATE TABLE price_history (id serial PRIMARY KEY, channel_price_id int, old_input_price numeric,
  new_input_price numeric, old_output_price numeric, new_output_price numeric,
  change_percent numeric, recorded_at timestamptz);
INSERT INTO providers VALUES (1,'p'); INSERT INTO models VALUES (1,'m');
INSERT INTO api_channel_prices VALUES (13755,1,1,2.5,10),(14787,1,1,0.1,0.4),(2,1,1,3,3),(3,1,1,1,1);
INSERT INTO price_history (channel_price_id,old_input_price,new_input_price,old_output_price,new_output_price,recorded_at) VALUES
 -- 13755: old zero-net burst (drop), real change 1.25/5 -> 2.5/10, newest zero-net burst (keep)
 (13755,1,2,4,8,'2026-09-01 00:00Z'),(13755,2,1,8,4,'2026-09-01 00:03Z'),
 (13755,1.25,2.5,5,10,'2026-09-05 00:00Z'),
 (13755,2.5,5,10,15,'2026-09-11 02:13Z'),(13755,5,2.5,15,10,'2026-09-11 02:19Z'),
 -- 14787: newest burst zero-net 0.1/0.4 -> 0.5/10 -> 0.1/0.4
 (14787,0.5,0.1,10,0.4,'2026-09-02 00:00Z'),
 (14787,0.1,0.5,0.4,10,'2026-09-12 00:00Z'),(14787,0.5,0.1,10,0.4,'2026-09-12 00:04Z'),
 -- 2: cycling burst 1->2->3 collapses to one row
 (2,1,2,1,2,'2026-09-03 00:00Z'),(2,2,3,2,3,'2026-09-03 00:01Z'),
 -- 3: whole history is a single zero-net burst
 (3,1,5,1,5,'2026-09-04 00:00Z'),(3,5,1,5,1,'2026-09-04 00:02Z');
SQL
OUT=$("${PSQL[@]}" -f scripts/sql/2026-10-12-dedupe-price-history.sql -c "
SELECT 'LATEST', channel_price_id, new_input_price, new_output_price FROM (
 SELECT DISTINCT ON (channel_price_id) * FROM price_history ORDER BY channel_price_id, recorded_at DESC, id DESC) x
 ORDER BY 1,2;
SELECT 'ROWS', count(*) FROM price_history;" 2>&1)
echo "$OUT"
expect() { grep -qxF "$1" <<<"$OUT" || { echo "FAIL: missing '$1'"; exit 1; }; }
expect 'LATEST|2|3|3'; expect 'LATEST|3|1|1'
expect 'LATEST|13755|2.5|10'; expect 'LATEST|14787|0.1|0.4'
expect 'ROWS|6'   # 13755:2, 14787:2, 2:1, 3:1 (old zero-net burst of 13755 dropped)
grep -q 'dedupe assertion ok' <<<"$OUT" || { echo "FAIL: no assertion notice"; exit 1; }
echo PASS
