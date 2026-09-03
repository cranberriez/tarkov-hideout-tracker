# Developer Panel

The `/dev` route is available only while `NODE_ENV=development`; production and
other environments receive a 404. A Dev navigation item is shown only in the same
environment.

The page inspects the Turso releases selected by
`src/server/db/release-config.ts`. For PVP, PVE, and KORD it shows:

- the configured immutable release ID;
- generated and uploaded timestamps;
- schema version and ready status;
- source freshness metadata;
- entity, item-view, item-search, and manifest record counts.

This is a read-only database diagnostic. It does not fetch current Tarkov.dev
datasets, compare snapshots, change a release pointer, or alter persisted user
data.
