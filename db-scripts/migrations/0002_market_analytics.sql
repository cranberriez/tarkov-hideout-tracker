-- Derived market analytics written by the market-analyzer worker. Tarkov.dev
-- remains the canonical raw price history; only our explainable measurements
-- are retained. Observations deliberately have no item_modes foreign key so
-- analytic history survives catalog removals.
CREATE TABLE IF NOT EXISTS market_analysis_runs (
  run_id text PRIMARY KEY,
  mode text NOT NULL CHECK (mode IN ('regular','pve','pvp-season')),
  started_at bigint NOT NULL,
  completed_at bigint NOT NULL,
  status text NOT NULL CHECK (status IN ('succeeded','partial')),
  analyzed_count integer NOT NULL,
  unchanged_count integer NOT NULL,
  missing_count integer NOT NULL,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS market_analysis_runs_mode_completed_idx ON market_analysis_runs(mode, completed_at DESC);

CREATE TABLE IF NOT EXISTS item_market_observations (
  mode text NOT NULL CHECK (mode IN ('regular','pve','pvp-season')),
  item_id text NOT NULL,
  calculated_at bigint NOT NULL,
  run_id text NOT NULL REFERENCES market_analysis_runs(run_id) ON DELETE CASCADE,
  source_updated_at bigint NOT NULL,
  -- Market state (flea minimum listing prices, RUB).
  live_price integer, live_price_min integer, live_offer_count integer,
  market_value integer, stability text NOT NULL,
  median_24h integer, median_7d integer, median_30d integer,
  range_low_7d integer, range_high_7d integer,
  change_6h real, change_24h real, change_7d real,
  percentile_30d real, volatility_7d real,
  trend text NOT NULL CHECK (trend IN ('rising','falling','stable','unknown')),
  persistence_hours real, depth_median_24h real,
  confidence text NOT NULL CHECK (confidence IN ('high','medium','low')),
  -- Economic state (baseline player: no Intelligence Center fee reduction).
  base_price integer, trader_value integer, flea_net integer,
  trader_break_even integer, practical_break_even integer, max_net_price integer,
  -- Supporting evidence, typed rather than JSON to keep append-only rows compact.
  confidence_reasons text[] NOT NULL, stability_reasons text[] NOT NULL,
  coverage_24h real NOT NULL, coverage_7d real NOT NULL, coverage_30d real NOT NULL,
  regime_points smallint NOT NULL, trader_id text, flea_fee integer, max_net integer,
  PRIMARY KEY (mode, item_id, calculated_at)
);
CREATE INDEX IF NOT EXISTS item_market_observations_run_idx ON item_market_observations(run_id);
