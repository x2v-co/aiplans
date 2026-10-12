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

-- Inspect, then COMMIT or ROLLBACK manually.
-- COMMIT;
