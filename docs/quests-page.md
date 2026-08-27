# Quests Page

The `/quests` route displays Tarkov.dev quest data in a full-height split workspace: a compact filtered quest log on the left and inline quest details or Raid Planner on the right. The legacy By Trader, By Map, and List components remain in the source for compatibility and focused reuse, but are no longer the route's primary presentation. See `quests-workspace-redesign.md` for the current interaction model.

---

## Route & Files

| File                                                    | Role                                                                                                                          |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `src/app/(data)/quests/page.tsx`                        | Server component; fetches full quest data, builds quest item and availability metadata, passes props to `QuestsClientPage`    |
| `src/features/quests/QuestsClientPage.tsx`              | Client shell; manages selected item modal state, renders search/filter chrome, wraps content in `QuestsProvider`              |
| `src/features/quests/QuestsContext.tsx`                 | React context + provider; reads store filters, owns local search text, computes derived quest maps and filtered quest lists   |
| `src/features/quests/QuestCard.tsx`                     | Individual quest card; badges, objectives, item thumbnails, prerequisite/unlock chips, pin/ignore/complete/have-items actions |
| `src/features/quests/components/QuestsList.tsx`         | By Map and By Trader grouped views, plus the ungrouped List view                                                              |
| `src/features/quests/components/QuestsSidebar.tsx`      | Filter sidebar; trader and map multi-select, kappa/LK filters, view mode controls                                             |
| `src/features/quests/components/QuestsCharacterBar.tsx` | Player level, prestige, faction, and trader loyalty controls                                                                  |
| `src/features/quests/components/QuestsFilterBar.tsx`    | Hide completed, available only, hand-in, pinned, ignored, and prerequisite/debug toggles                                      |
| `src/features/quests/components/QuestsSearchBar.tsx`    | Local quest search input                                                                                                      |
| `src/features/quests/components/QuestsSyncBar.tsx`      | Entry points for manual sync/import actions                                                                                   |
| `src/features/quests/components/QuestSyncDialog.tsx`    | Manual sync dialog state and step routing                                                                                     |
| `src/features/quests/quest-sync.ts`                     | Pure manual sync engine and availability wrapper                                                                              |
| `src/features/quests/quest-map-groups.ts`               | Map-group normalization for filters and By Map grouping                                                                       |
| `src/features/quests/quest-sorting.ts`                  | Sort utilities for quest views and unlock-impact counts                                                                       |
| `src/features/quests/components/quest-ui.tsx`           | Shared UI primitives                                                                                                          |
| `src/server/services/questsJson.ts`                     | JSON-only `getCachedJsonFullQuestData()` implementation                                                                       |
| `src/server/services/quests.ts`                         | Shared `orderQuestsByPrerequisites()` utility; GraphQL fetching in this file is legacy and is not used by the route            |
| `src/lib/utils/quest-item-index.ts`                     | Builds and derives quest item hand-in metadata                                                                                |
| `src/lib/utils/quest-availability.ts`                   | Converts full quests to the lighter availability shape and checks profile availability                                        |

---

## Data Flow

```text
/quests page (server component)
  -> getCachedFullQuestData()
  -> orderQuestsByPrerequisites(quests)
  -> buildQuestItemIndex(quests)
  -> quests.map(toQuestAvailabilityQuest)
  -> <QuestsClientPage
       quests={ordered}
       questItemIndex={...}
       questAvailabilityQuests={...}
     />
      -> <QuestsProvider onItemClick={setSelectedItemId}>
          -> QuestsContent renders QuestsList
          -> Quest item clicks open ItemDetailModal
```

Quest data is not part of the shared `(data)/layout.tsx` context. Pages that need quest data fetch it server-side. `getCachedFullQuestData()` is exported by `tarkovData.ts`, but always resolves to the JSON implementation regardless of `TARKOV_DATA_SOURCE`; `/quests` and `/items` therefore cannot fall back to GraphQL. The quests page derives `traders` and `allMaps` from the loaded full quest data; it does not currently need `getCachedTraders()`.

---

## Quest Ordering

`orderQuestsByPrerequisites()` in `src/server/services/quests.ts`:

- Computes `prerequisiteDepth` as the longest prerequisite chain depth.
- Breaks cycles with a `visiting` guard set.
- Sorts by `prerequisiteDepth`, then `minPlayerLevel`, then `name`.

The sorted order supplies the default chain-aware order used by the virtualized quest lists.

---

## State

Quest progress, profile settings, and filter preferences live in `useUserStore` and are persisted to localStorage. See `state-management.md` for storage key, version, migration, and full state shape.

Important persisted quest fields:

```ts
completedQuests: Record<string, boolean>;
failedQuests: Record<string, boolean>;
questsWithItems: Record<string, boolean>;
ignoredQuests: Record<string, boolean>;
pinnedQuests: Record<string, boolean>;
questChangeHistory: Array<{
    questId: string;
    timestamp: number;
    change: "completed" | "uncompleted";
}>;

playerLevel: number;
prestigeLevel: number;
questFaction: "USEC" | "BEAR" | null;
questTraderLoyaltyLevels: Record<string, number>;
questFenceReputation: number;

questViewMode: "byMap" | "byTrader" | "flatList";
questCardSize: "small" | "large"; // Legacy compatibility field; no longer exposed in the UI.
questSortMode: "default" | "level" | "xp" | "unlockImpact";
questSelectedTraders: string[];
questSelectedMaps: string[];
questHideCompleted: boolean;
questShowAvailableOnly: boolean;
questShowHandInOnly: boolean;
questShowFirHandInOnly: boolean;
questShowPinnedOnly: boolean;
questShowIgnored: boolean;
questShowDebug: boolean;
questShowPrereqs: boolean;
questShowKappa: boolean;
questShowLightkeeper: boolean;
questSidebarCollapsed: boolean;
```

`QuestsContext` wraps store values and computes:

- `questsById`: O(1) quest lookup.
- `leadsToByQuestId`: inverted prerequisite index.
- `failureMap`: completed quest id to task-status fail-condition target ids for mutually exclusive branches.
- `kappaQuestIds` / `lightkeeperQuestIds`: transitive prerequisite closures.
- `filteredQuests`: active filters and local search applied in order.
- `traders` and `allMaps`: deduped filter lists derived from full quest data.
- `questSortMode`: applied to By Trader, By Map, and List views.
- Manual sync helpers that call `quest-sync.ts` and write results back to `useUserStore`.

The workspace's filter headers use an in-pane selection state: choosing Traders,
Maps, Status, or Filter / Sort replaces the left quest list with that section's
options at the same bounded width. Trader, map, status, quest-type, and sort
selections are persisted in localStorage and shared across game-mode profiles.
Filter / Sort combines enabled-by-default trader and issuing-trader loyalty-level grouping,
the four existing sort modes, and the quest-type filter. Group headers show their
visible quest count and collapse their complete nested section when clicked. The
grouping switches and collapsed groups are local workspace display state and reset
to both grouping levels enabled when the workspace remounts. Trader additional options include an
enabled-by-default requirement toggle and per-trader LL1-LL4 profile controls.
Fence has LL1/max controls plus an exact persisted standing input; BTR Driver
and Lightkeeper have no loyalty controls. Quest list rows display the issuing
trader's required loyalty level beside the trader name, with a crown for LL4.

The workspace keeps quests completed during an `Active`-only view visible for the
rest of the current filter session. Changing a quest filter or search text clears
that temporary retention, as does refreshing the page. This prevents the quest
the user just completed from disappearing before they can review or undo it.

The History button beside search replaces the left quest log with reverse-
chronological completion changes. History entries persist only the quest ID,
timestamp, and whether the quest was completed or uncompleted. Current quest data
is joined at render time, and selecting a history entry opens the normal quest
details pane where all standard actions remain available. Entries are deduplicated
by quest ID and change type, so each quest contributes at most one completion and
one uncompletion item. Repeating a change replaces its older item and timestamp.

## Quest Organization and Series Review

The By Trader view can organize quests into five derived categories: Trader Tier 1
(LL1), Trader Tier 2 (LL2), Trader Tier 3 (LL3), Trader Tier 4 (LL4), and Series
Quests. This organization is derived from the loaded `FullQuest[]` data and the
curated ID-based manifest at `src/lib/data/quest-series.json`; it is not stored in
Zustand. Series membership has precedence over the issuing trader's tier, and
members inside a series use the manifest's explicit `order`.

`src/lib/utils/quest-organization.ts` validates the manifest before deriving the
organization. It reports unknown quest IDs, duplicate series membership, duplicate
orders, invalid orders, issuing-trader mismatches, and invalid tier values. A
cross-trader series must opt in with `allowCrossTrader: true` in the manifest.
Names and prerequisite graphs are not used at runtime to guess series membership.

To produce review candidates from a downloaded task snapshot, run:

```bash
npm run quest-series-candidates -- path/to/tasks.json > quest-series-candidates.json
```

The read-only tool in `scripts/generate-quest-series-candidates.mjs` accepts a raw
tasks record or array, a mapped quests array, and serialized `body` wrappers such
as a fetch-cache response. Its deterministic stdout report groups numbered names,
same-trader prerequisite components with at least two quests, and repeated prefixes
such as `Gunsmith` and `The Huntsman Path`. It flags duplicate names, branches,
faction variants, cross-trader members, and cross-trader prerequisite edges for
manual review. The report is only a candidate list; commit only reviewed manifest
entries, and do not use runtime name matching as production behavior.

Progression gates remain separate from display organization. `taskRequirements`
are the authoritative quest prerequisite/status edges used by availability, sync,
cascade, and relationship display. A trader requirement of `level` (or the legacy
`loyaltyLevel` spelling) is a loyalty-level gate; `reputation` is a standing gate
and must not be treated as LL. Cross-trader level gates remain visible and affect
availability, but do not change a quest's issuing-trader category. JSON
`otherRequirements` such as `globalVariable` and `dialogue` are preserved as typed
raw gates; they are not currently interpreted as loyalty levels or series IDs.

Organization changes do not alter persisted progress. The localStorage key remains
`tarkov-hideout-user-state` at Zustand version 17, and `completedQuests`,
`failedQuests`, `questsWithItems`, `ignoredQuests`, and `pinnedQuests` remain maps
keyed by the upstream quest IDs. Categories, series names, and manifest ordering
must never be used to infer or rewrite completion records.

---

## Search & Filters

`QuestsSearchBar` stores immediate input locally and debounces writes to `QuestsContext.searchQuery`. `filteredQuests` matches search text against quest name, trader name, and map name after the persisted filters are applied.

The page supports filters for completion, availability, hand-in objectives, FiR hand-ins, pinned quests, ignored quests, kappa/LK quest chains, selected traders, selected maps, faction, player level, prestige, and trader loyalty.

Map filtering uses both `quest.map` and `quest.objectives[].maps`. Quests with objective-level maps appear in each matching map group. Quests with no quest-level or objective-level maps are treated as `Any Map` and remain visible when a concrete map filter is selected. In the By Map view, an active sidebar map filter limits the rendered map headers to the selected map groups so overlapping quests do not repopulate unrelated map sections.

---

## State Subscription & Performance Notes

The quest page is render-heavy. Prefer Zustand selectors over bare `useUserStore()`:

```ts
const completedQuests = useUserStore((state) => state.completedQuests);

const { completedQuests, ignoredQuests } = useUserStore(
    useShallow((state) => ({
        completedQuests: state.completedQuests,
        ignoredQuests: state.ignoredQuests,
    })),
);
```

Avoid bare `useUserStore()` in quest components unless the component intentionally needs to rerender for every persisted user-state change.

Derived quest data should stay scoped to the active view:

| View                             | Component        | Expensive derived work                              |
| -------------------------------- | ---------------- | --------------------------------------------------- |
| By Trader                        | `QuestsList.tsx` | Trader grouping and selected sort mode              |
| By Map (`questViewMode: "byMap"`) | `QuestsList.tsx` | Map grouping and selected sort mode                 |
| List (`questViewMode: "flatList"`) | `QuestsList.tsx` | Single virtualized list and selected sort mode      |

All quest views support these sort modes:

| Sort mode        | Behavior                                                                    |
| ---------------- | --------------------------------------------------------------------------- |
| `default`        | Existing chain-aware requirement ordering                                   |
| `level`          | Lower `minPlayerLevel` first, with default order as tie-breaker             |
| `xp`             | Higher `experience` first, with default order as tie-breaker                |
| `unlockImpact`  | More unique transitive downstream unlocks first, with default order as tie-breaker |

Quest cards show sort-specific metadata for XP and Unlock Impact sorts. Level sort does not add a separate chip because the card already displays quest level.

Quest item modals read flea market data from `PriceDataContext`. The shared price map includes quest-required items, so quest-only hand-in items can show the same Tarkov.dev flea data as hideout items.

---

## Manual Quest Sync

Manual sync is temporarily hidden in the UI while the workflow is reviewed. Its
implementation remains available and is gated by `ENABLE_MANUAL_QUEST_SYNC` in
`src/features/quests/quest-feature-flags.ts`.

Manual sync reconstructs completed quest state from the quests a player can currently see for one trader. The user selects active quests for that trader; the app completes prerequisite chains and can infer other completed branches.

Functional map:

| Area                     | File                                                      | Notes                                                                                     |
| ------------------------ | --------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Open sync/import actions | `src/features/quests/components/QuestsSyncBar.tsx`        | Buttons beside quest filters                                                              |
| Modal state              | `src/features/quests/components/QuestSyncDialog.tsx`      | Tracks selected quest IDs by trader, last sync result, undo invalidation                  |
| Profile step             | `src/features/quests/components/QuestSyncProfileStep.tsx` | Player level, faction, prestige profile inputs                                            |
| Trader step              | `src/features/quests/components/QuestSyncTraderStep.tsx`  | Shows active trader quests, preview result, sync button, sensitive prerequisite decisions |
| Context bridge           | `src/features/quests/QuestsContext.tsx`                   | Preview calls pure sync; sync writes `completedQuests` and `questsWithItems`              |
| Sync engine              | `src/features/quests/quest-sync.ts`                       | Pure function `syncTraderProgress()`; easiest place to change behavior and test it        |
| Availability checks      | `src/lib/utils/quest-availability.ts`                     | Level, faction, prestige, trader loyalty, and prerequisite availability                   |
| Sensitive gates          | `src/lib/utils/sensitive-quest-backfill.ts`               | Blocks known high-impact prerequisite chains unless the user explicitly allows/denies     |
| Focused tests            | `src/features/quests/quest-sync.test.ts`                  | Node test coverage for sync inference and sensitive backfill behavior                     |

Sync engine rules:

- Selected quests are not marked complete; they are anchors representing quests currently visible/active in game.
- `prerequisiteCompletedIds` are transitive prerequisites of explicitly selected quests.
- `inferredCompletedIds` are extra quests inferred as completed from the selected trader's visible chains.
- The manual dialog has a local inference toggle. Turning it off still completes prerequisites for selected anchor quests but skips same-trader inferred completions.
- Failed quests are treated as already resolved for sync prerequisite traversal and availability; sync preserves the failed state instead of rewriting it to completed.
- Branching quests are not auto-completed by inference while all mutually exclusive branches are unresolved. If an inferred candidate has non-optional task-status fail conditions and every competing branch is still unresolved, sync reports it in `skippedBranchingQuestIds` and leaves both completion and failed state unchanged. If a competing branch is already completed or failed, inference continues normally.
- `autoFailedQuestIds` are mutually exclusive quests automatically marked failed when synced completions satisfy task-status fail conditions.
- Candidate inference scans quests from the selected trader.
- Cross-trader prerequisites are completed only when they are prerequisites of explicitly selected anchor quests.
- Sync no longer has a user-facing "infer other trader chains" toggle; speculative cross-trader inference was removed to avoid false positives. Same-trader inference still exists.
- If any blocker remains, such as player level, faction, prestige, trader loyalty, failed state, or missing prerequisite state, no inferred completion is written for that candidate.
- `blockedSensitiveQuestIds` identifies sensitive prerequisite chains that need a user decision before syncing.

Focused sync tests are not wired to an npm script:

```bash
node --test --import jiti/register src/features/quests/quest-sync.test.ts
```

Run this when changing manual sync behavior before `npm run lint` and `npm run build`.

---

## Workspace Quest Details

Selecting a quest opens a cohesive tracker detail pane. It presents Tarkov.dev's
human-readable objective descriptions with larger interactive item rows directly
under the relevant objective. Matching find and hand-over objectives are placed
together and show their shared items once after the hand-over objective. Repeated
quest-item records follow the same presentation. Any item group over ten entries
starts with a ten-item preview and can be expanded in place to the complete group.
Completion XP and trader-standing rewards appear last as compact text.
The bounded detail layout is left-aligned within the pane. Provider links appear
above Objectives; the current normalized quest shape supplies `wikiLink` only.
Objective item rows prefer the non-grid `iconLink` image and fall back to
`gridImageLink` when needed. Rewards remain a compact vertical list.

Raw objective metadata is not rendered as chips below each objective. A local bug
button in the bottom-right corner opens normalized objective JSON and the normalized
full quest JSON for inspection. This debug drawer is display-only and does not add
or change persisted quest preferences.

## Raid Planner mapping

The Raid Planner uses real objective zone geometry from the normalized JSON quest
payload. It loads only the selected map's compact SVG definition, projects the
world `x/z` plane using the configured rotation/transform, and renders one marker
per positioned zone plus polygon outlines when present. Every location belonging
to the same quest shares its list symbol and color. Hover/focus remains
bidirectional between markers and quest rows.

Quests associated with the selected map but lacking any positioned zone or quest-
item geometry stay visible in a `Location unavailable` group. Possible quest-item
spawns repeat one shared quest symbol at every known position. Duplicate positions
inside one quest are collapsed into one marker and their objective information is
combined in its tooltip.

Quest detail panes do not render maps yet.

The full quest cache retains complete objective item groups for this expandable
display. Broad any-of groups remain classified separately and are not treated as
exact checklist demand. The provider does not currently retain wiki dialogue, guide
prose/screenshots, or the full conditional item/currency reward sets. The detail
pane must not infer those fields from objective text.

---

## QuestCard Anatomy

`QuestCard.tsx` renders:

- Completion, pin, ignore, and have-items controls backed by `useUserStore`.
- Failed and disabled quest states for fail-capable mutually exclusive branches.
- Trader avatar, quest name, level/map/kappa/LK/faction/trader-loyalty/prestige badges.
- Trader reputation rewards from completion and trader reputation penalties from quest failure.
- Compact item strip for exact `giveItem` and `plantItem` objectives; item thumbnails call `onItemClick(itemId)`.
- Collapsed cards show a bare key icon when any objective has `requiredKeys`; expanded objective rows show the relevant key items under that objective.
- Broad any-item `giveItem` and `plantItem` objectives keep a partial preview of up to 15 items in checklist-derived group data and are excluded from exact item checklist demand. The full quest objective retains all items for the expandable selected-quest display.
- Expanded objective rows for all objective types.
- Requires/unlocks chips linked to `#quest-{id}`.
- Optional debug JSON when `questShowDebug` is enabled.

API quirks to keep in mind:

| Field                                    | Quirk                                   | Correct handling                                             |
| ---------------------------------------- | --------------------------------------- | ------------------------------------------------------------ |
| `quest.factionName`                      | Returns `"Any"` for unrestricted quests | Only render faction badge for exactly `"USEC"` or `"BEAR"`   |
| `quest.minPlayerLevel`                   | `0` represents no useful displayed minimum | Keep it in progression data, but render a level badge only when greater than zero |
| `quest.trader.imageLink` / `image4xLink` | Can be `null` or `undefined`            | Normalize to `null` where a stable reference shape is needed |

---

## Caching

| Layer                    | Key                                      | Freshness                   |
| ------------------------ | ---------------------------------------- | --------------------------- |
| Redis                    | `quests:full:v13:{mode}` + matching `:meta` key | 12h service freshness check |
| Next.js `unstable_cache` | `["quests-full"]`                        | `revalidate: 43200`         |

To invalidate quest data for application code, bump the relevant version in `src/lib/cfg/cacheVersions.ts`. See `caching-architecture.md`.
