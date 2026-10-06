CREATE TABLE IF NOT EXISTS items (
  id text PRIMARY KEY, name text NOT NULL, normalized_name text NOT NULL, short_name text,
  icon_link text, grid_image_link text, image_512px_link text, base_image_link text,
  link text, wiki_link text
);
CREATE TABLE IF NOT EXISTS item_modes (
  item_id text NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('regular','pve','pvp-season')),
  on_flea_market boolean, min_level_for_flea integer, category jsonb, display_override jsonb,
  source_updated_at bigint, PRIMARY KEY (item_id,mode)
);
CREATE TABLE IF NOT EXISTS traders (
  id text PRIMARY KEY, name text NOT NULL, normalized_name text NOT NULL,
  image_link text, image_4x_link text
);
CREATE TABLE IF NOT EXISTS trader_modes (
  trader_id text NOT NULL REFERENCES traders(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('regular','pve','pvp-season')),
  display_override jsonb, PRIMARY KEY (trader_id,mode)
);
CREATE TABLE IF NOT EXISTS stations (
  id text PRIMARY KEY, name text NOT NULL, normalized_name text NOT NULL, image_link text
);
CREATE TABLE IF NOT EXISTS station_modes (
  station_id text NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('regular','pve','pvp-season')),
  display_override jsonb, source_updated_at bigint, PRIMARY KEY (station_id,mode)
);
CREATE TABLE IF NOT EXISTS station_levels (
  station_id text NOT NULL, mode text NOT NULL CHECK (mode IN ('regular','pve','pvp-season')),
  level integer NOT NULL, level_id text NOT NULL, construction_time numeric NOT NULL,
  station_requirements jsonb NOT NULL, skill_requirements jsonb NOT NULL,
  trader_requirements jsonb NOT NULL, PRIMARY KEY (station_id,mode,level),
  CONSTRAINT station_levels_variant_fk FOREIGN KEY(station_id,mode)
    REFERENCES station_modes(station_id,mode) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS station_item_requirements (
  station_id text NOT NULL, mode text NOT NULL CHECK (mode IN ('regular','pve','pvp-season')),
  level integer NOT NULL, requirement_id text NOT NULL, item_id text NOT NULL,
  quantity numeric NOT NULL, found_in_raid boolean NOT NULL, is_tool boolean NOT NULL,
  PRIMARY KEY (station_id,mode,level,requirement_id),
  CONSTRAINT station_item_requirements_level_fk FOREIGN KEY(station_id,mode,level)
    REFERENCES station_levels(station_id,mode,level) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS station_item_requirements_mode_item_idx ON station_item_requirements(mode,item_id);
CREATE TABLE IF NOT EXISTS skills (
  id text PRIMARY KEY, name text NOT NULL, image_link text
);
CREATE TABLE IF NOT EXISTS skill_modes (
  skill_id text NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('regular','pve','pvp-season')),
  display_override jsonb, PRIMARY KEY(skill_id,mode)
);
CREATE TABLE IF NOT EXISTS quests (
  id text PRIMARY KEY, name text NOT NULL, normalized_name text NOT NULL,
  wiki_link text, task_image_link text
);
CREATE TABLE IF NOT EXISTS quest_modes (
  quest_id text NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('regular','pve','pvp-season')),
  trader_id text, min_player_level integer, experience integer NOT NULL,
  faction_name text, kappa_required boolean, lightkeeper_required boolean,
  removed boolean NOT NULL, map jsonb, display_override jsonb, source_updated_at bigint,
  objectives jsonb NOT NULL, task_requirements jsonb NOT NULL, fail_conditions jsonb NOT NULL,
  trader_requirements jsonb NOT NULL, other_requirements jsonb NOT NULL,
  required_prestige jsonb, reward_groups jsonb NOT NULL,
  PRIMARY KEY(quest_id,mode),
  CONSTRAINT quest_modes_trader_fk FOREIGN KEY(trader_id,mode)
    REFERENCES trader_modes(trader_id,mode)
);
CREATE INDEX IF NOT EXISTS quest_modes_mode_trader_idx ON quest_modes(mode,trader_id);
CREATE TABLE IF NOT EXISTS crafts (
  id text NOT NULL, mode text NOT NULL CHECK (mode IN ('regular','pve','pvp-season')),
  product_item_id text NOT NULL, product_count numeric NOT NULL, station_id text NOT NULL,
  level integer NOT NULL, duration numeric NOT NULL, task_unlock_id text,
  required_items jsonb NOT NULL, required_quest_items jsonb NOT NULL, game_editions jsonb NOT NULL,
  PRIMARY KEY(id,mode)
);
CREATE INDEX IF NOT EXISTS crafts_mode_product_idx ON crafts(mode,product_item_id);
CREATE INDEX IF NOT EXISTS crafts_mode_station_level_idx ON crafts(mode,station_id,level);
CREATE TABLE IF NOT EXISTS barters (
  id text NOT NULL, mode text NOT NULL CHECK (mode IN ('regular','pve','pvp-season')),
  offered_item_id text NOT NULL, offered_count numeric NOT NULL, trader_id text NOT NULL,
  min_trader_level integer NOT NULL, task_unlock_id text, buy_limit numeric,
  required_items jsonb NOT NULL, PRIMARY KEY(id,mode)
);
CREATE INDEX IF NOT EXISTS barters_mode_offered_idx ON barters(mode,offered_item_id);
CREATE INDEX IF NOT EXISTS barters_mode_trader_idx ON barters(mode,trader_id);
CREATE TABLE IF NOT EXISTS item_prices (
  item_id text NOT NULL, mode text NOT NULL CHECK (mode IN ('regular','pve','pvp-season')),
  price integer CHECK(price IS NULL OR price >= 0), reference_price integer,
  latest_price integer, latest_price_min integer, latest_offer_count integer, latest_point_at bigint,
  sample_count integer NOT NULL DEFAULT 0, total_offer_count integer NOT NULL DEFAULT 0,
  last_checked_at bigint, avg_24h_price numeric, high_24h_price integer, low_24h_price integer,
  last_low_price integer, change_last_48h numeric, change_last_48h_percent numeric, diff_24h numeric,
  catalog_average_price numeric, catalog_high_price numeric, catalog_low_price numeric,
  catalog_reference_updated_at bigint, trader_purchase_offers jsonb NOT NULL DEFAULT '[]'::jsonb,
  trader_sell_offers jsonb NOT NULL DEFAULT '[]'::jsonb, recent_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_changed_at bigint, PRIMARY KEY(item_id,mode),
  CONSTRAINT item_prices_item_mode_fk FOREIGN KEY(item_id,mode)
    REFERENCES item_modes(item_id,mode) ON DELETE CASCADE,
  CONSTRAINT item_prices_recent_points_check CHECK(jsonb_typeof(recent_points)='array' AND jsonb_array_length(recent_points)<=10)
);
CREATE TABLE IF NOT EXISTS item_price_sync (
  item_id text NOT NULL, mode text NOT NULL CHECK (mode IN ('regular','pve','pvp-season')),
  etag text, last_checked_at bigint, consecutive_failures integer NOT NULL DEFAULT 0,
  last_error text, PRIMARY KEY(item_id,mode),
  CONSTRAINT item_price_sync_item_mode_fk FOREIGN KEY(item_id,mode)
    REFERENCES item_modes(item_id,mode) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS item_discovery (
  item_id text NOT NULL, mode text NOT NULL CHECK (mode IN ('regular','pve','pvp-season')),
  first_seen_at bigint, first_seen_patch text, legacy_first_seen_release_id text,
  PRIMARY KEY(item_id,mode)
);
CREATE TABLE IF NOT EXISTS item_details (
  item_id text NOT NULL, mode text NOT NULL CHECK (mode IN ('regular','pve','pvp-season')),
  relations jsonb NOT NULL, usage jsonb NOT NULL, acquisition jsonb NOT NULL,
  PRIMARY KEY(item_id,mode),
  CONSTRAINT item_details_item_mode_fk FOREIGN KEY(item_id,mode)
    REFERENCES item_modes(item_id,mode) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS catalog_status (
  mode text PRIMARY KEY CHECK (mode IN ('regular','pve','pvp-season')),
  content_version bigint NOT NULL DEFAULT 0, checked_at bigint, updated_at bigint,
  source_freshness jsonb NOT NULL DEFAULT '{}'::jsonb,
  discovery_initialized boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS price_refresh_state (
  mode text PRIMARY KEY CHECK (mode IN ('regular','pve','pvp-season')),
  lease_owner text, lease_expires_at bigint, last_started_at bigint, last_completed_at bigint,
  last_summary jsonb
);
