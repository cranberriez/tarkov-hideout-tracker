PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS data_releases (
    mode TEXT NOT NULL CHECK (mode IN ('regular', 'pve', 'pvp-season')),
    release_id TEXT NOT NULL,
    schema_version INTEGER NOT NULL,
    generated_at INTEGER NOT NULL,
    snapshot_sha256 TEXT NOT NULL,
    source_freshness_json TEXT NOT NULL CHECK (json_valid(source_freshness_json)),
    record_counts_json TEXT NOT NULL CHECK (json_valid(record_counts_json)),
    status TEXT NOT NULL CHECK (status IN ('uploading', 'ready')),
    uploaded_at INTEGER,
    PRIMARY KEY (mode, release_id)
) STRICT;

CREATE TABLE IF NOT EXISTS active_data_releases (
    mode TEXT PRIMARY KEY CHECK (mode IN ('regular', 'pve', 'pvp-season')),
    release_id TEXT NOT NULL,
    activated_at INTEGER NOT NULL,
    FOREIGN KEY (mode, release_id) REFERENCES data_releases (mode, release_id)
) STRICT;

CREATE TABLE IF NOT EXISTS data_entities (
    mode TEXT NOT NULL,
    release_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    sort_key TEXT,
    updated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
    PRIMARY KEY (mode, release_id, entity_type, entity_id),
    FOREIGN KEY (mode, release_id) REFERENCES data_releases (mode, release_id)
) STRICT;

CREATE INDEX IF NOT EXISTS data_entities_by_type
    ON data_entities (mode, release_id, entity_type, sort_key, entity_id);

CREATE TABLE IF NOT EXISTS item_views (
    mode TEXT NOT NULL,
    release_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    view_type TEXT NOT NULL CHECK (view_type IN ('relations', 'usage', 'acquisition')),
    updated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
    PRIMARY KEY (mode, release_id, item_id, view_type),
    FOREIGN KEY (mode, release_id) REFERENCES data_releases (mode, release_id)
) STRICT;

CREATE INDEX IF NOT EXISTS item_views_by_item
    ON item_views (mode, release_id, item_id);

CREATE TABLE IF NOT EXISTS item_search (
    mode TEXT NOT NULL,
    release_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    compact_name TEXT NOT NULL,
    sort_name TEXT NOT NULL,
    preview_json TEXT NOT NULL CHECK (json_valid(preview_json)),
    PRIMARY KEY (mode, release_id, item_id),
    FOREIGN KEY (mode, release_id) REFERENCES data_releases (mode, release_id)
) STRICT;

CREATE INDEX IF NOT EXISTS item_search_by_name
    ON item_search (mode, release_id, normalized_name, sort_name);

CREATE INDEX IF NOT EXISTS item_search_by_compact_name
    ON item_search (mode, release_id, compact_name, sort_name);

CREATE TABLE IF NOT EXISTS data_manifests (
    mode TEXT NOT NULL,
    release_id TEXT NOT NULL,
    manifest_name TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
    PRIMARY KEY (mode, release_id, manifest_name),
    FOREIGN KEY (mode, release_id) REFERENCES data_releases (mode, release_id)
) STRICT;

CREATE TABLE IF NOT EXISTS item_prices (
    mode TEXT NOT NULL CHECK (mode IN ('regular', 'pve', 'pvp-season')),
    item_id TEXT NOT NULL,
    effective_price INTEGER, -- robust minimum estimate; NULL for explicit no-offer history
    latest_price INTEGER,
    latest_price_min INTEGER,
    latest_offer_count INTEGER,
    latest_point_timestamp INTEGER,
    sample_count INTEGER NOT NULL DEFAULT 0,
    total_offer_count INTEGER NOT NULL DEFAULT 0, -- legacy name; latest depth, not a snapshot sum
    etag TEXT,
    last_checked_at INTEGER NOT NULL,
    last_changed_at INTEGER,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    PRIMARY KEY (mode, item_id)
) STRICT;

CREATE INDEX IF NOT EXISTS item_prices_by_freshness
    ON item_prices (mode, latest_point_timestamp);

CREATE TABLE IF NOT EXISTS item_price_points (
    mode TEXT NOT NULL CHECK (mode IN ('regular', 'pve', 'pvp-season')),
    item_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    price INTEGER NOT NULL,
    price_min INTEGER NOT NULL,
    offer_count INTEGER,
    observed_at INTEGER NOT NULL,
    PRIMARY KEY (mode, item_id, timestamp)
) STRICT;

CREATE INDEX IF NOT EXISTS item_price_points_by_item_time
    ON item_price_points (mode, item_id, timestamp DESC);

CREATE TABLE IF NOT EXISTS price_refresh_locks (
    mode TEXT PRIMARY KEY CHECK (mode IN ('regular', 'pve', 'pvp-season')),
    run_id TEXT NOT NULL,
    locked_until INTEGER NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS price_refresh_runs (
    run_id TEXT PRIMARY KEY,
    mode TEXT NOT NULL CHECK (mode IN ('regular', 'pve', 'pvp-season')),
    started_at INTEGER NOT NULL,
    completed_at INTEGER,
    status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'partial', 'failed')),
    eligible_count INTEGER NOT NULL DEFAULT 0,
    checked_count INTEGER NOT NULL DEFAULT 0,
    changed_count INTEGER NOT NULL DEFAULT 0,
    not_modified_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    error TEXT
) STRICT;

CREATE INDEX IF NOT EXISTS price_refresh_runs_by_mode_time
    ON price_refresh_runs (mode, started_at DESC);
