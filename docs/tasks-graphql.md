# Tasks & Traders — GraphQL Reference

Findings from live schema introspection against `https://api.tarkov.dev/graphql` on 2026-05-10.

> The API calls them **tasks**. The app calls them **quests**. They are the same thing.

---

## Traders query

```graphql
query Traders {
  traders(lang: en) {
    id
    name
    normalizedName
    imageLink
    image4xLink
  }
}
```

### Known traders (as of 2026-05-10)

| Name | normalizedName | Notes |
|---|---|---|
| Prapor | prapor | |
| Therapist | therapist | |
| Fence | fence | |
| Skier | skier | |
| Peacekeeper | peacekeeper | |
| Mechanic | mechanic | |
| Ragman | ragman | |
| Jaeger | jaeger | |
| Lightkeeper | lightkeeper | |
| BTR Driver | btr-driver | `image4xLink` falls back to `unknown-trader-4x.webp` |
| Ref | ref | |
| Radio station | radio-station | `image4xLink` falls back to `unknown-trader-4x.webp` |
| Taran | taran | `image4xLink` falls back to `unknown-trader-4x.webp` |
| Mr. Kerman | mr-kerman | `image4xLink` falls back to `unknown-trader-4x.webp` |
| Voevoda | voevoda | `image4xLink` falls back to `unknown-trader-4x.webp` |

`image4xLink` is the high-res avatar used on quest cards. Newer traders have a generic fallback — check before assuming a crisp image exists.

---

## Tasks query

`objectives` is a **GraphQL interface** (`TaskObjective`). You must use inline fragments (`... on TypeName { }`) to access type-specific fields.

```graphql
query Tasks {
  tasks(lang: en) {
    id
    name
    normalizedName
    wikiLink
    minPlayerLevel
    kappaRequired
    lightkeeperRequired
    factionName
    experience
    trader {
      id
      name
      normalizedName
    }
    taskRequirements {
      task {
        id
        name
      }
      status
    }
    objectives {
      id
      type
      description
      optional
      ... on TaskObjectiveItem {
        count
        foundInRaid
        items {
          id
          name
          normalizedName
          iconLink
          gridImageLink
        }
      }
    }
  }
}
```

### Fields omitted from the query above (and why)

| Field | Reason to omit |
|---|---|
| `tarkovDataId` | Internal Tarkov ID, not needed for display |
| `taskImageLink` | Task splash art — not used in current card design |
| `map` | Top-level map hint; objective-level `maps` is more precise |
| `startRewards` / `finishRewards` | Reward display not planned yet |
| `failureOutcome` | Failure outcome display not planned |
| `restartable` | Not used |
| `requiredPrestige` | Prestige system display not planned |
| `traderRequirements` | Trader loyalty gating — could be added later |
| `availableDelaySecondsMin/Max` | Availability timers, not needed |
| Message ID fields | Raw Tarkov message IDs, not user-facing |

Add these back to the query as features are added — they are valid fields.

---

## Schema deep-dive

### `Task` type

| Field | Type | Notes |
|---|---|---|
| `id` | `ID` | Stable across wipes |
| `name` | `String!` | |
| `normalizedName` | `String!` | URL-safe slug |
| `trader` | `Trader!` | Embedded object — id, name, normalizedName always present |
| `minPlayerLevel` | `Int` | Nullable — null means no level gate |
| `kappaRequired` | `Boolean` | True = needed for Kappa container |
| `lightkeeperRequired` | `Boolean` | True = needed for Lightkeeper unlock |
| `factionName` | `String` | `"Any"` \| `"BEAR"` \| `"USEC"` |
| `experience` | `Int!` | XP on completion |
| `wikiLink` | `String` | Nullable — not every task has a wiki page |
| `taskRequirements` | `[TaskStatusRequirement]!` | Prerequisite tasks |
| `failConditions` | `[TaskObjective]!` | Conditions that fail the task, including task-status branch exclusions and generic conditions |
| `objectives` | `[TaskObjective]!` | Interface — see below |

### `TaskStatusRequirement` (prerequisites)

```ts
{
  task: { id: string; name: string }
  status: string[] // e.g. ["complete"]
}
```

This is the prerequisite graph. `orderQuestsByPrerequisites` (already implemented) consumes exactly this shape.

### `TaskObjective` interface

All objective types share these base fields:

| Field | Type | Notes |
|---|---|---|
| `id` | `ID` | |
| `type` | `String!` | Discriminant — see type list below |
| `description` | `String!` | Human-readable objective text |
| `maps` | `[Map]!` | Maps where this objective is relevant (empty = any map) |
| `optional` | `Boolean!` | Whether this objective is required for completion |

**All possible `type` values (concrete implementations):**

| `type` | Concrete type | Description |
|---|---|---|
| `giveItem` | `TaskObjectiveItem` | Hand items to trader — the primary type we care about |
| `visit` | `TaskObjectiveBasic` | Visit a location |
| `extract` | `TaskObjectiveExtract` | Extract from a map |
| `shoot` | `TaskObjectiveShoot` | Kill enemies with conditions |
| `mark` | `TaskObjectiveMark` | Place a marker |
| `findItem` / `pickupQuestItem` | `TaskObjectiveQuestItem` | In-raid quest items (not regular inventory) |
| `buildItem` | `TaskObjectiveBuildItem` | Craft/build an item |
| `experience` | `TaskObjectiveExperience` | Reach an XP threshold |
| `playerLevel` | `TaskObjectivePlayerLevel` | Reach a player level |
| `skill` | `TaskObjectiveSkill` | Reach a skill level |
| `traderLevel` | `TaskObjectiveTraderLevel` | Reach a trader loyalty level |
| `traderStanding` | `TaskObjectiveTraderStanding` | Reach a trader standing value |
| `taskStatus` | `TaskObjectiveTaskStatus` | Requires another task to be in a specific state |
| `hideoutStation` | `TaskObjectiveHideoutStation` | Build a hideout station level |
| `useItem` | `TaskObjectiveUseItem` | Use an item in-raid |

### `TaskObjectiveItem` — the `giveItem` type

Additional fields beyond the base interface:

| Field | Type | Notes |
|---|---|---|
| `items` | `[Item]!` | **Any-of list** — player gives `count` of any item in this list |
| `count` | `Int!` | How many to hand over |
| `foundInRaid` | `Boolean!` | Whether FiR status is required |
| `dogTagLevel` | `Int` | Minimum dogtag level (for dogtag-specific tasks) |
| `maxDurability` | `Int` | Durability cap |
| `minDurability` | `Int` | Durability floor |
| `zones` | `[TaskZone]` | |
| `requiredKeys` | `[[Item]]` | Keys needed to access the handover location |

**Critical:** `items` is an **any-of** list, not **all-of**. Example: "Hand over 3 found-in-raid medicine items" returns 21 different medicine items in `items[]`. The player only needs to give 3 of any of them. UI must reflect this — it is architecturally different from hideout requirements.

### `TaskObjectiveQuestItem` — special in-raid items

| Field | Type | Notes |
|---|---|---|
| `questItem` | `QuestItem!` | References a `QuestItem` (not a regular `Item`) |
| `count` | `Int!` | |
| `possibleLocations` | `[MapWithPosition]` | Where to find the item |

`QuestItem` has no `iconLink` or `gridImageLink`. These objectives cannot be cross-referenced with flea/trader data. **Filter these out** when building an item hand-in list — use `type === "giveItem"` as the guard.

---

## Service implementation notes

### Cache keys

Both services use the centralized `CACHE_VERSIONS` in `src/lib/cfg/cacheVersions.ts`:

```ts
export const CACHE_VERSIONS = {
  // ...existing keys...
  quests: 3,   // bump when query shape changes
  traders: 1,
}
```

Redis keys follow the pattern:
- `quests:all:v${CACHE_VERSIONS.quests}` + `:meta`
- `traders:all:v${CACHE_VERSIONS.traders}` + `:meta`

### Server-side filtering

Filter tasks to only those with at least one `giveItem` objective before caching — no point storing the full dataset if the page only shows item hand-ins. This keeps the Redis payload smaller and the client types simpler.

```ts
const filtered = tasks.filter(t =>
  t.objectives.some(o => o.type === "giveItem")
);
```

### Traders service

The traders query is trivial to transform — no nested mapping needed, just `id`, `name`, `normalizedName`, `imageLink`, `image4xLink`. Pull into its own service so it can be cached independently and reused if traders are needed on other pages.

### `factionName` field

Live data shows `"Any"` for all standard quests. Faction-exclusive quests will be `"BEAR"` or `"USEC"`. Worth storing so a faction filter can be added later without a cache-key bump.

---

## Patterns carried forward from hideout service

The `hideout.ts` service pattern applies directly:

1. Try Redis (`mget` body + meta key)
2. Check freshness (`Date.now() - meta.updatedAt < CACHE_WINDOW_MS`)
3. On hit: return cached body (handle both object and JSON string from Redis)
4. On miss: fetch GraphQL, transform, write to Redis (`mset` body + meta), return
5. On upstream error: fall back to stale cache if available, else throw
6. Wrap with `unstable_cache` for Next.js 12h revalidation

Both new services should follow this pattern exactly.
