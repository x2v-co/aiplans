-- One-off cleanup for the price_history cycling bug fixed on 2026-10-12.
-- NOT run automatically. Review the preview first; requires approval to run.
--
-- Before the fix, several scraped entries that resolved to the same model
-- upserted one api_channel_prices row in turn within a single scrape round,
-- logging a history row per hop (e.g. 0.5 -> 1 -> 1.5 -> 3 -> 0.5).
-- This collapses each burst (rows for one channel_price_id less than 10
-- minutes apart) into a single row from the first old_* to the last new_*,
-- and drops bursts whose net change is zero.

BEGIN;

-- Full backup, created inside the transaction (rolled back with it).
-- Drop it manually once the cleanup has been checked.
CREATE TABLE price_history_backup_20261012 AS SELECT * FROM price_history;

CREATE TEMP TABLE ph_bursts ON COMMIT DROP AS
WITH ordered AS (
  SELECT ph.*,
         CASE WHEN recorded_at - lag(recorded_at) OVER w > interval '10 minutes'
                   OR lag(recorded_at) OVER w IS NULL THEN 1 ELSE 0 END AS new_burst
  FROM price_history ph
  WINDOW w AS (PARTITION BY channel_price_id ORDER BY recorded_at, id)
), grouped AS (
  SELECT *, sum(new_burst) OVER (PARTITION BY channel_price_id ORDER BY recorded_at, id) AS burst
  FROM ordered
)
SELECT channel_price_id, burst,
       array_agg(id ORDER BY recorded_at, id)                              AS ids,
       (array_agg(old_input_price  ORDER BY recorded_at, id))[1]           AS first_old_in,
       (array_agg(old_output_price ORDER BY recorded_at, id))[1]           AS first_old_out,
       (array_agg(new_input_price  ORDER BY recorded_at DESC, id DESC))[1] AS last_new_in,
       (array_agg(new_output_price ORDER BY recorded_at DESC, id DESC))[1] AS last_new_out
FROM grouped
GROUP BY channel_price_id, burst
HAVING count(*) > 1;

-- Preview
SELECT count(*) AS bursts, sum(array_length(ids, 1)) AS rows_in_bursts FROM ph_bursts;

-- Keep the first row of each burst, rewritten to the net change.
UPDATE price_history ph
SET new_input_price  = b.last_new_in,
    new_output_price = b.last_new_out,
    change_percent   = CASE WHEN coalesce(b.first_old_in, 0) = 0 THEN 0
                            ELSE (b.last_new_in - b.first_old_in) / b.first_old_in * 100 END
FROM ph_bursts b
WHERE ph.id = b.ids[1];

DELETE FROM price_history ph USING ph_bursts b
WHERE ph.id = ANY (b.ids[2:]);

-- Drop bursts that net to no change.
DELETE FROM price_history ph USING ph_bursts b
WHERE ph.id = b.ids[1]
  AND ph.old_input_price IS NOT DISTINCT FROM ph.new_input_price
  AND ph.old_output_price IS NOT DISTINCT FROM ph.new_output_price;

-- ── Verification ─────────────────────────────────────────────────────────
-- Per-model before/after row counts (largest reductions first).
SELECT m.slug AS model, pr.slug AS channel,
       b.cnt AS rows_before, coalesce(a.cnt, 0) AS rows_after
FROM (SELECT channel_price_id, count(*) cnt FROM price_history_backup_20261012 GROUP BY 1) b
LEFT JOIN (SELECT channel_price_id, count(*) cnt FROM price_history GROUP BY 1) a USING (channel_price_id)
LEFT JOIN api_channel_prices acp ON acp.id = b.channel_price_id
LEFT JOIN models m ON m.id = acp.model_id
LEFT JOIN providers pr ON pr.id = acp.provider_id
ORDER BY b.cnt - coalesce(a.cnt, 0) DESC
LIMIT 50;

-- Latest recorded price per channel_price must be unchanged. A channel whose
-- whole history netted to zero now has no rows; its latest price then must
-- equal the live api_channel_prices row (i.e. the history was pure noise).
-- Expect 0 rows from this query.
WITH before AS (
  SELECT DISTINCT ON (channel_price_id) channel_price_id, new_input_price, new_output_price
  FROM price_history_backup_20261012 ORDER BY channel_price_id, recorded_at DESC, id DESC
), after AS (
  SELECT DISTINCT ON (channel_price_id) channel_price_id, new_input_price, new_output_price
  FROM price_history ORDER BY channel_price_id, recorded_at DESC, id DESC
)
SELECT b.channel_price_id, b.new_input_price AS before_in, b.new_output_price AS before_out,
       a.new_input_price AS after_in, a.new_output_price AS after_out,
       acp.input_price_per_1m AS live_in, acp.output_price_per_1m AS live_out
FROM before b
LEFT JOIN after a USING (channel_price_id)
LEFT JOIN api_channel_prices acp ON acp.id = b.channel_price_id
WHERE (a.channel_price_id IS NOT NULL AND (a.new_input_price IS DISTINCT FROM b.new_input_price
                                           OR a.new_output_price IS DISTINCT FROM b.new_output_price))
   OR (a.channel_price_id IS NULL AND (acp.input_price_per_1m IS DISTINCT FROM b.new_input_price
                                       OR acp.output_price_per_1m IS DISTINCT FROM b.new_output_price));

SELECT (SELECT count(*) FROM price_history_backup_20261012) AS rows_before,
       (SELECT count(*) FROM price_history) AS rows_after;

-- Inspect, then COMMIT or ROLLBACK manually.
-- COMMIT;
