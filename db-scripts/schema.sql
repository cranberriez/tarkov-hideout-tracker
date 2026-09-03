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
