# Item Data Separation Refactor

## Status

Proposed target architecture and implementation plan. This document describes a
replacement for the current tracked-item service; it is not a description of the
current runtime behavior.

## Compatibility Boundary

The only backwards-compatibility requirement is preservation of player data.

The refactor must not change or invalidate:

- The persisted Zustand storage key, version, profile structure, or persisted field names.
- Item IDs used by inventory counts.
- Quest IDs used by completion, failure, ignore, and pin state.
- Hideout station IDs or requirement IDs used by station progress and manually completed requirements.
- Existing PVP, PVE, and KORD player profiles.

Server-fetched data is replaceable. Service names, TypeScript response shapes,
Redis keys, cache versions, and cache composition may change without compatibility
adapters. Old Redis keys should simply stop being read and expire naturally.

The JSON API is the only provider in scope. GraphQL should be treated as unused and
must not influence the new service boundaries or types.

## Problem

`getJsonHideoutRequiredItems()` currently owns too many unrelated responsibilities.
It loads stations, full quests, the standard item catalog, traders, barters, and
crafts; scans station and quest records for item IDs; hydrates rich item objects;
embeds matching acquisition data; writes the result to Redis; and returns the same
large result through Next.js `unstable_cache`.

This creates several problems:

- The service name no longer describes its output.
- Quest-specific items are mixed with ordinary inventory items.
- Complete item records are repeated inside station and quest structures.
- Barters and crafts are embedded in every applicable item even though only the
  item modal uses them.
- Unused upstream item fields are cached and serialized to the browser.
- The resulting response exceeds Next.js's 2 MB data-cache limit.
- Every route under the shared data layout pays for item, station, barter, and
  craft work whether it needs all of it or not.

## Design Principles

1. Each upstream JSON domain has one owner.
2. Relationships between domains are stored as IDs, not nested copies.
3. Rich records are composed at the point of use.
4. Quest-specific items remain quest presentation data.
5. User-specific requirement totals remain client-derived from player progress.
6. Large source caches must not be passed through `unstable_cache` unless their
   serialized size is proven to remain comfortably below its limit.

## Target Data Flow

```text
/items ───────────────► global item catalog ───────► item lookup in DataContext
/hideout ─────────────► station requirements ──────► join catalog by itemId
/tasks ───────────────► quest data
                         ├─ standard item IDs ─────► join global catalog
                         └─ quest-specific items ─► inline quest display only
/barters ─────────────► barter index ─┐
/crafts ──────────────► craft index ──┴────────────► lazy item-modal usage lookup
```

## Service Boundaries

### Global item catalog

`getGlobalItemList(mode)` is the sole owner of the standard `/items` dataset.
Because JSON is the only supported provider, consumers should call this service
directly rather than route through a provider-selection facade. An internal
implementation name such as `getJsonGlobalItemList` is optional but should not
leak into client-facing types.

The service must:

- Normalize every standard `/items` record exactly once.
- Import no hideout, quest, barter, or craft service.
- Include no task-only quest items.
- Include no embedded barter or craft arrays.
- Return only an explicit allowlist of fields used by the application.

Initial catalog fields:

```ts
interface GlobalItem {
    id: string;
    name: string;
    normalizedName: string;
    shortName?: string;
    iconLink?: string;
    gridImageLink?: string;
    image512pxLink?: string;
    baseImageLink?: string;
    link?: string;
    wikiLink?: string;
    minLevelForFlea?: number | null;
    category?: ItemCategory;
    categories?: ItemCategory[];
    marketPrice?: GlobalItemMarketPrice;
}
```

The initial market shape should retain only values with current consumers:

- `avg24hPrice`
- `high24hPrice`
- `low24hPrice`
- `lastLowPrice`
- `lastOfferCount`
- `changeLast48hPercent`
- `updatedAt`
- compact trader sale values containing vendor presentation and `priceRUB`

Fields currently fetched but not used should be omitted, including description,
provider update string, dimensions, weight, types, inspection image, 8x image,
base price, absolute 48-hour change, duplicate price aliases, and unused trader
sale currency/original-price fields.

`DataContext` should expose the catalog array for iteration and a memoized lookup
by ID. It must not serialize a `Map` from the server. Station and quest records
should resolve catalog information only while rendering or composing a view.

### Hideout requirements

Hideout item requirements belong to the station dataset. They should be normalized
to references rather than full item records:

```ts
interface HideoutItemRequirement {
    id: string;
    itemId: string;
    count: number;
    isFir: boolean;
    isTool: boolean;
}
```

The stable requirement `id` must be preserved because it participates in player
data. `count` should replace the current duplicate `count`/`quantity` representation.

A helper named `getHideoutItemRequirements(stations)` may flatten or select these
records, but it should be a pure function rather than a separate upstream or Redis
cache. Final needed counts remain client-derived from station progress, hidden
stations, and completed requirements.

### Quest standard items and quest-specific items

The quest mapper must retain the distinction that the upstream data already makes:

- Standard objective items resolve from `/items` and are stored as item IDs.
- Quest-specific pickup/find items resolve from `tasks.questItems` and retain only
  compact inline presentation data.

Standard catalog references include give, find, and plant objective items,
required keys, build targets, `containsAll`, and `useAny`. These may join the global
catalog for display. Existing exact, any-of, broad-any, FiR, and `plantItem` demand
semantics must remain unchanged.

Quest-specific items should use a separate type:

```ts
interface QuestSpecificItem {
    id: string;
    name: string;
    normalizedName: string;
    shortName?: string;
    iconLink?: string;
    gridImageLink?: string;
}
```

They are inline quest content only. They must not enter inventory counts, Quick
Add, item search, the global catalog, market lookup, acquisition lookup, or the
generic item modal.

`getQuestItemRequirements(quests)` should be a pure derivation for checklist
demand. `getQuestSpecificItems(quests)` may provide a convenient lookup, but a
separate Redis cache is unnecessary unless measurement later demonstrates a need.

Broad objectives may preserve their complete list of standard item IDs for quest
display, but must not repeat names, images, prices, or other catalog metadata.

### Barters and crafts

Barters and crafts should have independent JSON services and Redis caches. Their
canonical records should be normalized around IDs:

```ts
interface ItemAmountRef {
    itemId: string;
    count: number;
    isTool?: boolean;
}

interface BarterRecord {
    id: string;
    offeredItemId: string;
    offeredCount: number;
    traderId: string;
    minTraderLevel: number;
    taskUnlockId?: string;
    requiredItems: ItemAmountRef[];
    buyLimit?: number | null;
}

interface CraftRecord {
    id: string;
    productItemId: string;
    productCount: number;
    stationId: string;
    level: number;
    duration: number;
    taskUnlockId?: string;
    requiredItems: ItemAmountRef[];
    requiredQuestItems: ItemAmountRef[];
    gameEditions: string[];
}
```

Each dataset should be indexed server-side by its offered or produced item ID. The
browser should receive only the records matching the selected modal item. One lazy
route such as `/api/items/{itemId}/usage?mode=...` may compose the independently
cached barter and craft results.

The item modal should resolve ingredient item presentation through the global
catalog. Optional barter or craft failures must not prevent catalog, hideout,
quest, inventory, or market data from loading.

## Cache Layout

Suggested new keys:

| Cache | Contents | Tag |
|---|---|---|
| `items:catalog:v1:{mode}` | Compact standard item catalog and market data | `item-data` |
| `hideout:stations:vNext:{mode}` | Stations with ID-based item requirements | `hideout-data` |
| `quests:full:vNext:{mode}` | Quest content, standard item IDs, and quest-specific display data | `quests` |
| `items:barters:v1:{mode}` | Normalized barter index | `barter-data` |
| `items:crafts:v1:{mode}` | Normalized craft index | `craft-data` |

All keys and lookups must include the active `regular`, `pve`, or `pvp-season`
mode. Existing stale-fallback and empty-upstream protections should remain.

Redis should remain the cross-deployment cache for large source datasets. Do not
wrap a full catalog, barter index, or craft index in Next.js `unstable_cache`
unless a size test proves the returned value remains well below 2 MB. Small
per-item usage responses may use Next or HTTP caching.

## Compact Refactor Plan

### 1. Replace the source services and contracts

- Measure current item counts and serialized sizes for all three modes.
- Introduce the normalized catalog, requirement, quest-specific item, barter, and
  craft types.
- Implement `getGlobalItemList()` from `/items` only, with a strict field allowlist
  and a new Redis key.
- Implement independent normalized barter and craft services and indexes.
- Add size, normalization, mode-isolation, missing-reference, and stale-fallback tests.

This step may replace the old server response shapes directly. Compatibility
adapters are not required because this data is not persisted player state.

### 2. Normalize hideout and quest references

- Change station requirements to `itemId`, `count`, `isFir`, and `isTool` while
  preserving station and requirement IDs.
- Stop embedding or layout-enriching full item records in stations.
- Split standard quest item references from task-only quest-specific items during
  JSON mapping.
- Store standard quest references as IDs and keep quest-specific items as compact
  inline records.
- Preserve existing quest demand behavior, including `plantItem`, any-of groups,
  broad groups, and FiR counts.

### 3. Rewire consumers and lazy-load acquisition data

- Add a memoized global item lookup to `DataContext`.
- Update hideout, checklist, search, Quick Add, quest, and modal consumers to join
  standard items by ID.
- Make quest-specific item rows display-only and non-clickable.
- Retain the item modal for standard quest items that resolve in the catalog.
- Add lazy per-item barter/craft loading with independent loading, empty, and error states.
- Verify that missing optional acquisition data never blocks the rest of the UI.

### 4. Remove the old pipeline and verify player-data safety

- Remove `getJsonHideoutRequiredItems()`, its facade exports, its Next cache
  wrapper, and the `hideoutItems` cache-version field.
- Remove embedded `traderOffers` and `crafts`, quest fallback catalog merging,
  station enrichment, dead item-map work, and unused item fields.
- Remove or bypass provider-selection code for these JSON-only domains; do not
  rebuild the design around GraphQL compatibility.
- Update the revalidation tags and current architecture documentation.
- Run lint, build, focused unit tests, and manual PVP/PVE/KORD checks.
- Compare persisted player state before and after the refactor and confirm that
  inventory, station progress, completed requirements, quest progress, filters,
  and profiles remain unchanged.
- Re-measure Redis entries and browser/RSC payloads. Absence of the Next.js error
  alone is not sufficient; the resulting payloads should remain under an explicit
  regression budget.

## Completion Criteria

The refactor is complete when:

- The global catalog is sourced exclusively from `/items`.
- Hideout and quest structures reference standard items by ID.
- Quest-specific items remain quest-only presentation data.
- Barters and crafts are cached independently and loaded per selected item.
- No large source response triggers the Next.js 2 MB cache failure.
- No persisted player data changes or is lost.
- All three game modes resolve only mode-matched catalog and acquisition data.

