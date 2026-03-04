-- Delete old Claude 3 Opus model and its channel price references
-- This removes the "Claude 3 Opus" entry (id=2013) which was incorrectly mapped to
-- by Arena models and should be replaced by Claude 4 Opus models

BEGIN;

-- Delete channel price references for product 2013
DELETE FROM channel_prices WHERE product_id = 2013;

-- Delete the old Claude 3 Opus product (id=2013)
DELETE FROM products WHERE id = 2013;

COMMIT;
