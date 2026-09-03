# Quest Data and Category Rework

This document records how quest data enters the application and proposes a new
five-category quest organization. It is intended to be a short reference for
future quest work.

## Current Data Source

Quest data comes exclusively from Tarkov.dev's JSON API. Page and API queries read
through `TarkovDataRepository`; the current implementation delegates normalization
to `src/server/services/questsJson.ts`. `TARKOV_DATA_SOURCE` is no longer consulted.
The quest adapter requests these datasets:

```text
https://json.tarkov.dev/regular/tasks
https://json.tarkov.dev/regular/tasks_en
https://json.tarkov.dev/regular/traders
https://json.tarkov.dev/regular/traders_en
https://json.tarkov.dev/regular/maps
https://json.tarkov.dev/regular/maps_en
https://json.tarkov.dev/regular/hideout
https://json.tarkov.dev/regular/hideout_en
```

`src/server/services/tarkovJson/client.ts` fetches the base record and matching
English translation dictionary together. Base records mainly contain IDs and
translation keys. `src/server/services/questsJson.ts` resolves those references
and maps the result into the shared `FullQuest` type in `src/types/quests.ts`.

## Current Request Flow

```text
Tarkov.dev JSON datasets
  -> fetchTarkovJsonDataset()
  -> questsJson.ts hydrates traders, maps, items, and translations
  -> FullQuest[]
  -> versioned Redis cache
  -> Next.js unstable_cache wrapper
  -> src/app/(data)/quests/page.tsx
  -> prerequisite ordering and item/availability indexes
  -> QuestsClientPage and QuestsContext
  -> quest views and cards
```

The quests page receives full quest data as server props. Quest data is not part
of the shared data layout context.

Progression data is currently frozen during the Tarkov 1.1 transition. The
relevant values are in `src/lib/cfg/cacheVersions.ts` and the quest page/service
use `revalidate = false`. When the mapped quest shape changes, bump
`CACHE_VERSIONS.questsFull` before unfreezing or refreshing the cache.

## Upstream Fields Relevant to Progression

### `taskRequirements`

Actual quest-to-quest status requirements:

```ts
{
    task: "required quest id",
    status: ["complete"]
}
```

These remain authoritative for availability, completion cascade, unlock chips,
and sync behavior. A prerequisite relationship does not necessarily mean that
two quests belong to the same named series.

### `traderRequirements`

Trader gates currently use at least two distinct requirement types:

```ts
{
    trader: "trader id",
    requirementType: "level",
    compareMethod: ">=",
    value: 2
}
```

`requirementType: "level"` represents trader loyalty level (LL/tier).

```ts
{
    trader: "trader id",
    requirementType: "reputation",
    compareMethod: ">=",
    value: 2
}
```

`requirementType: "reputation"` is a standing requirement and must not be
displayed or evaluated as a loyalty level.

A quest may require a level from a trader other than the trader issuing the
quest. Preserve and display those cross-trader requirements.

### `otherRequirements`

The current JSON data also contains `globalVariable` and `dialogue`
requirements. The JSON adapter does not map these fields yet. They should be
preserved as typed raw progression gates before availability behavior is added.
They are not safe to interpret as loyalty levels or quest-series identifiers.

### Series information

As of the August 24, 2026 data snapshot, tasks do not expose a dedicated
`seriesId`, `seriesName`, or questline field. `taskRequirements` identifies many
sequential relationships, but it is not a complete series definition. For
example, recognizable families can contain multiple quests without internal
prerequisite edges.

If Tarkov.dev adds explicit series metadata later, it should take precedence
over local classification after its shape and semantics are validated.

## Proposed Five Categories

Every quest belongs to exactly one of these categories within its issuing
trader:

1. Trader Tier 1 (LL1)
2. Trader Tier 2 (LL2)
3. Trader Tier 3 (LL3)
4. Trader Tier 4 (LL4)
5. Series Quests

Category precedence is important:

```text
recognized series member -> Series Quests
otherwise                -> issuing trader's LL1-LL4 category
```

A series quest may still have trader-level requirements. Those requirements
continue to control availability and appear on the quest card, but the quest is
displayed in Series Quests rather than duplicated in a tier category.

For non-series quests, derive the category from the issuing trader's explicit
`requirementType: "level"` requirement. If no issuing-trader level requirement
exists, use LL1. Cross-trader level requirements do not change the quest's
category, but must remain visible as additional gates.

## Series Definition

Series membership should be stable, reviewable, and keyed by quest ID. Use a
small local manifest rather than runtime name guessing:

```json
{
  "version": 1,
  "series": [
    {
      "id": "health-care-privacy",
      "name": "Health Care Privacy",
      "traderId": "trader-id",
      "members": [
        { "questId": "quest-id-1", "order": 1 },
        { "questId": "quest-id-2", "order": 2 }
      ]
    }
  ]
}
```

Recommended location: `src/lib/data/quest-series.json`.

Use API data to generate candidates for review:

- Prefer explicit upstream series metadata if it becomes available.
- Detect numbered names such as `Name - Part 1` and `Name - Part 2`.
- Find same-trader prerequisite chains containing two or more quests.
- Detect well-known repeated prefixes such as `Gunsmith -` and
  `The Huntsman Path -`.
- Flag duplicate names, branches, faction variants, and cross-trader chains for
  manual review.

Candidate detection should be a maintenance script, not production behavior.
Quest names can change, translations differ, and prerequisite edges can express
gates that are not semantic questlines.

## Proposed Derived Model

Keep category and series data derived from server quest data. Do not add them to
the persisted Zustand store.

```ts
type QuestCategory = "tier-1" | "tier-2" | "tier-3" | "tier-4" | "series";

interface DerivedQuestOrganization {
    questId: string;
    category: QuestCategory;
    issuingTraderTier: 1 | 2 | 3 | 4;
    seriesId: string | null;
    seriesName: string | null;
    seriesOrder: number | null;
}
```

Also expose normalized requirements separately:

```ts
interface DerivedTraderGate {
    traderId: string;
    type: "level" | "reputation";
    compareMethod: string;
    value: number;
}
```

This keeps display grouping separate from availability rules.

## Implementation Plan

### 1. Normalize the updated API fields

- Add typed `otherRequirements` to the JSON raw types and shared full quest
  shape.
- Normalize `traderRequirements` without changing their upstream meaning.
- Add helpers that distinguish `level` from `reputation`.
- Keep the normalized JSON response shape stable for current consumers.
- Add mapping tests using small saved fixtures rather than the complete live
  dataset.

### 2. Correct trader-gate availability and display

- Update availability checks to consider only `type: "level"` when comparing
  against `questTraderLoyaltyLevels`.
- Preserve all trader-level gates, including cross-trader requirements.
- Render level gates as `Trader LL2` and reputation gates as
  `Trader Rep >= 2`.
- Add focused tests for own-trader level, cross-trader level, reputation, and
  mixed requirements.

### 3. Add series data and maintenance tooling

- Create `src/lib/data/quest-series.json`.
- Add a script that reads a downloaded task snapshot and produces a candidate
  series report.
- Review candidates and commit only the curated manifest.
- Validate that every member ID exists, each quest belongs to at most one
  series, order values are unique within a series, and unexpected cross-trader
  membership is explicit.

### 4. Derive the five categories

- Add a pure `quest-organization` utility that combines `FullQuest[]` with the
  series manifest.
- Apply the Series-first precedence rule.
- Assign all remaining quests to LL1-LL4 using the issuing trader's level gate.
- Clamp or report invalid levels instead of silently creating extra categories.
- Unit-test all five categories, including a series quest that also requires
  LL3.

### 5. Update the quest UI

- Add a grouped view organized by trader and then the five categories.
- Within Series Quests, group by series name and use manifest order.
- Within tier categories, retain the selected quest sort mode where practical.
- Show the derived issuing-trader tier on cards or category headers.
- Keep prerequisite/unlock chips because they describe real availability even
  when the card is organized by series or tier.

### 6. Protect sync and persisted progress

- Do not use visual category or series membership to infer quest completion.
- Keep sync, cascade, and availability based on actual requirements.
- Do not change persisted quest IDs, Zustand storage keys, persisted field
  names, or existing completion records.
- Run the quest availability, sync, cascade, tree, sorting, and item-index tests
  after changing the shared quest shape.

### 7. Refresh documentation and caches

- Update `docs/quests-page.md` once the new grouped view is implemented.
- Update `docs/tasks-graphql.md` or add a JSON task schema reference for the new
  fields.
- Bump `CACHE_VERSIONS.questsFull` when the cached `FullQuest` shape changes.
- Verify a cold fetch before removing the current progression-data freeze.

## Suggested Delivery Boundaries

Implement the rework in three reviewable changes:

1. API normalization and trader-gate correctness.
2. Series manifest, generator, derived categories, and tests.
3. Quest UI grouping and documentation updates.

This keeps upstream data correctness separate from the larger UI change and
makes each stage independently testable.
