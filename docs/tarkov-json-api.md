# Tarkov JSON API Runtime

All runtime Tarkov.dev data comes from `https://json.tarkov.dev`. The application
does not select a provider at runtime: `TARKOV_DATA_SOURCE` is not consulted for
station, item, quest, trader, barter, or craft services. Page and API queries use
the `TarkovDataRepository` contract; the current repository delegates raw JSON
provider handling to adapters in `src/server/services/`.

All upstream requests send
`TarkovHideoutTracker/1.0 (+https://tarkovhideout.com)` so Tarkov.dev can attribute
traffic to the application.

## Datasets and modes

The JSON API publishes base records and English locale dictionaries for
translatable domains:

```text
/{mode}/hideout     /{mode}/hideout_en
/{mode}/items       /{mode}/items_en
/{mode}/tasks       /{mode}/tasks_en
/{mode}/traders     /{mode}/traders_en
/{mode}/maps        /{mode}/maps_en
/{mode}/barters
/{mode}/crafts
```

`mode` is `regular` for PVP, `pve` for PVE, and `pvp-season` for KORD. Every
normalized cache key includes this mode.

The JSON client fetches base and locale payloads together. If a PVE or KORD locale
is unavailable, it may use the matching regular English dictionary while keeping
the requested mode's base records. A missing base dataset or missing regular
locale fallback is an error. Concurrent requests for the same URL share one
in-flight promise.

## Domain ownership

- `itemsJson.ts` owns the standard `/items` catalog and its compact market data.
- `hideoutJson.ts` owns station structure and ID-based item requirements.
- `questsJson.ts` owns tasks and the task-only quest-specific item distinction.
- `tradersJson.ts` owns the compact trader list.
- `itemAcquisitionJson.ts` owns normalized barter and craft indexes.

The global catalog is not built by scanning hideout or quest references. It does
not embed stations, quest content, barters, or crafts. Relationships between
domains use IDs and are joined only by consumers.

## Standard and quest-specific items

Standard task references—including hand-ins, find/plant objectives, required
keys, build targets, `containsAll`, and `useAny`—are retained as catalog item IDs.
Task-owned pickup/find records from `tasks.questItems` are normalized separately
as compact `QuestSpecificItem` presentation.

Quest-specific items are not inventory objects. They do not enter the global
catalog, checklist demand, search, Quick Add, market pricing, acquisition lookup,
or the generic item modal.

## Quest progression fields

The tasks adapter preserves upstream quest IDs, level-0 quests, prerequisite task
IDs, fail conditions, trader requirements, prestige requirements, full objective
types, map geometry, and task-owned quest-item locations. Stable quest IDs remain
the keys for completion, failure, ignore, pin, and hand-in player state.

Trader requirements preserve their upstream requirement type. Loyalty-level
gates and reputation gates remain distinct; cross-trader requirements are not
collapsed. Typed `otherRequirements` are retained, with known trader-tier global
variables interpreted by `quest-trader-completion-gates.ts` and unknown gates kept
non-blocking.

Reviewed overlays remain separate from provider payloads:

- `quest-trader-tab-overrides.json` supplies trader-tab organization;
- `quest-faction-overrides.json` corrects reviewed faction assignments;
- `removed-quests.json` excludes validated removed quests from active demand;
- `quest-series.json` supplies reviewed series membership and ordering.

These overlays do not change persisted player data.

## Validation, fallback, and diagnostics

Adapters validate cached and upstream bodies. Redis failures are non-fatal, empty
upstream results are never written, and a valid stale body can be returned after
an upstream failure. Upstream requests time out after 30 seconds. Successful
responses include additive diagnostics for JSON provider status, resolved locale
paths, regular-locale fallback, and stale fallback.

Large catalog, barter, and craft source caches use Redis without
`unstable_cache`. Station and quest responses also have small Next.js wrappers.
See `caching-architecture.md` for exact keys, versions, and invalidation behavior.

## Persistence boundary

Provider normalization must not change the Zustand storage key, store version,
profile structure, persisted field names, or stable station, requirement, item,
and quest IDs. Server response shapes and versioned Redis keys may change when
their cache versions are bumped.
