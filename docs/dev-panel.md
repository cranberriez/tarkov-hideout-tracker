# Developer Panel

The `/dev` route is available only while `NODE_ENV=development`; production and
other environments receive a 404. A Dev navigation item is shown only in the same
environment.

## Cache policy

The policy table reports the effective Next.js-cache, Redis-read, and Redis-write
settings for every Redis-backed dataset. Global operation flags override dataset
flags. Changes require a development-server restart because Next.js cache wrappers
are selected when their service modules load.

Full and lightweight quest Redis writes default to disabled in development. This
makes the usual development configuration read-only for quest snapshots while
allowing normal Redis reads. Set an explicit global or quest-specific write flag
to opt back into writes.

## Quest history comparison

Choose PVP, PVE, or KORD and run the comparison. The panel loads the existing
versioned full-quest Redis snapshot and independently fetches and normalizes the
current Tarkov.dev task data. It reports:

- added and removed quest IDs;
- quests whose normalized top-level fields changed;
- the changed field names for each modified quest;
- stored and upstream counts and timestamps.

Each changed quest expands independently. Only fields that differ are shown in
two aligned JSON columns labeled **Ours · Redis** and **Tarkov.dev · Current**.
The line-aligned view preserves unchanged context inside those fields while
highlighting only removed or modified text in red and added or modified text in
green.

Before comparison, objects are canonicalized by key and set-like arrays are sorted
when every entry is a primitive or has a stable domain ID. This suppresses false
changes caused by nondeterministic map, objective, requirement, reward, or status
ordering. Positional arrays without stable IDs—such as map outlines and coordinate
sequences—retain their source order so geometry changes remain visible.

The upstream comparison path bypasses Next.js and Redis caches and never schedules
a Redis write. It does not alter cache keys or persisted user data.
