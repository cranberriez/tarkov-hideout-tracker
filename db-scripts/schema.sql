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

CREATE TABLE IF NOT EXISTS data_payloads (
    payload_hash TEXT PRIMARY KEY,
    payload_json TEXT NOT NULL CHECK (json_valid(payload_json))
) STRICT;

CREATE TABLE IF NOT EXISTS current_records (
    mode TEXT NOT NULL CHECK (mode IN ('regular', 'pve', 'pvp-season')),
    record_type TEXT NOT NULL CHECK (record_type IN ('entity', 'itemView', 'itemSearch', 'manifest')),
    record_id TEXT NOT NULL,
    variant TEXT NOT NULL,
    payload_hash TEXT NOT NULL REFERENCES data_payloads(payload_hash),
    content_hash TEXT NOT NULL,
    sort_key TEXT,
    normalized_name TEXT,
    compact_name TEXT,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (mode, record_type, record_id, variant)
) STRICT;
CREATE INDEX IF NOT EXISTS current_records_by_type ON current_records(mode, record_type, variant, sort_key, record_id);
CREATE INDEX IF NOT EXISTS current_records_by_name ON current_records(mode, normalized_name, sort_key) WHERE record_type = 'itemSearch';
CREATE INDEX IF NOT EXISTS current_records_by_compact_name ON current_records(mode, compact_name, sort_key) WHERE record_type = 'itemSearch';
CREATE INDEX IF NOT EXISTS current_records_by_payload ON current_records(payload_hash);

CREATE VIEW IF NOT EXISTS data_entities AS
SELECT r.mode, a.release_id, r.variant AS entity_type, r.record_id AS entity_id,
       r.sort_key, r.updated_at, p.payload_json
FROM current_records r JOIN data_payloads p USING(payload_hash)
JOIN active_data_releases a USING(mode) WHERE r.record_type = 'entity';
CREATE VIEW IF NOT EXISTS item_views AS
SELECT r.mode, a.release_id, r.record_id AS item_id, r.variant AS view_type,
       r.updated_at, p.payload_json
FROM current_records r JOIN data_payloads p USING(payload_hash)
JOIN active_data_releases a USING(mode) WHERE r.record_type = 'itemView';
CREATE VIEW IF NOT EXISTS item_search AS
SELECT r.mode, a.release_id, r.record_id AS item_id, r.normalized_name,
       r.compact_name, r.sort_key AS sort_name, p.payload_json AS preview_json
FROM current_records r JOIN data_payloads p USING(payload_hash)
JOIN active_data_releases a USING(mode) WHERE r.record_type = 'itemSearch';
CREATE VIEW IF NOT EXISTS data_manifests AS
SELECT r.mode, a.release_id, r.record_id AS manifest_name, r.updated_at, p.payload_json
FROM current_records r JOIN data_payloads p USING(payload_hash)
JOIN active_data_releases a USING(mode) WHERE r.record_type = 'manifest';

-- Durable catalog discovery survives snapshot replacement and item removal.
CREATE TABLE IF NOT EXISTS catalog_tracking (
    mode TEXT PRIMARY KEY CHECK (mode IN ('regular', 'pve', 'pvp-season')),
    baseline_release_id TEXT NOT NULL,
    initialized_at INTEGER NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS item_catalog_history (
    mode TEXT NOT NULL CHECK (mode IN ('regular', 'pve', 'pvp-season')),
    item_id TEXT NOT NULL,
    first_seen_at INTEGER,
    first_seen_patch TEXT NOT NULL,
    first_seen_release_id TEXT NOT NULL,
    PRIMARY KEY (mode, item_id),
    CHECK ((first_seen_patch = 'pre-1.1.5' AND first_seen_at IS NULL)
        OR (first_seen_patch <> 'pre-1.1.5' AND first_seen_at > 0 AND first_seen_at IS NOT NULL))
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
