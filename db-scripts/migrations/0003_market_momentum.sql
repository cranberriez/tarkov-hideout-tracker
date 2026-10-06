-- Short-term market response and rouble-denominated moves for item_market_observations.
-- Additive and nullable, so earlier observations remain valid.
ALTER TABLE item_market_observations
  ADD COLUMN IF NOT EXISTS change_24h_rub integer,
  ADD COLUMN IF NOT EXISTS change_7d_rub integer,
  ADD COLUMN IF NOT EXISTS current_level integer,
  ADD COLUMN IF NOT EXISTS move_12h real,
  ADD COLUMN IF NOT EXISTS shock_phase text CHECK (shock_phase IN ('holding','retracing','settled','reverted')),
  ADD COLUMN IF NOT EXISTS shock_baseline integer,
  ADD COLUMN IF NOT EXISTS shock_extreme integer,
  ADD COLUMN IF NOT EXISTS shock_at bigint,
  ADD COLUMN IF NOT EXISTS retracement real;
