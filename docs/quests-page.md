# Quests Page

The `/quests` route displays Tarkov.dev quest data: objectives, prerequisites, unlock chains, completion tracking, manual sync, and quest item hand-ins. Three view modes are exposed in the UI: **Tree**, **By Trader**, and **By Map**. The persisted internal value for By Map is still `questViewMode: "list"` for backward compatibility.

---

## Route & Files

| File                                                    | Role                                                                                                                          |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `src/app/(data)/quests/page.tsx`                        | Server component; fetches full quest data, builds quest item and availability metadata, passes props to `QuestsClientPage`    |
| `src/features/quests/QuestsClientPage.tsx`              | Client shell; manages selected item modal state, renders search/filter chrome, wraps content in `QuestsProvider`              |
| `src/features/quests/QuestsContext.tsx`                 | React context + provider; reads store filters, owns local search text, computes derived quest maps and filtered quest lists   |
| `src/features/quests/QuestCard.tsx`                     | Individual quest card; badges, objectives, item thumbnails, prerequisite/unlock chips, pin/ignore/complete/have-items actions |
| `src/features/quests/components/QuestsList.tsx`         | By Map and By Trader grouped views                                                                                            |
| `src/features/quests/components/QuestsTree.tsx`         | Tree view; per-trader trees with collapsible branches                                                                         |
| `src/features/quests/components/QuestsSidebar.tsx`      | Filter sidebar; trader and map multi-select, kappa/LK filters, view mode controls                                             |
| `src/features/quests/components/QuestsCharacterBar.tsx` | Player level, prestige, faction, and trader loyalty controls                                                                  |
| `src/features/quests/components/QuestsFilterBar.tsx`    | Hide completed, available only, hand-in, pinned, ignored, and prerequisite/debug toggles                                      |
| `src/features/quests/components/QuestsSearchBar.tsx`    | Local quest search input                                                                                                      |
| `src/features/quests/components/QuestsSyncBar.tsx`      | Entry points for manual sync/import actions                                                                                   |
| `src/features/quests/components/QuestSyncDialog.tsx`    | Manual sync dialog state and step routing                                                                                     |
| `src/features/quests/quest-sync.ts`                     | Pure manual sync engine and availability wrapper                                                                              |
| `src/features/quests/quest-map-groups.ts`               | Map-group normalization for filters and By Map grouping                                                                       |
| `src/features/quests/components/quest-ui.tsx`           | Shared UI primitives                                                                                                          |
| `src/server/services/quests.ts`                         | `getCachedFullQuestData()` and `orderQuestsByPrerequisites()`                                                                 |
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
          -> QuestsContent renders QuestsTree or QuestsList
          -> Quest item clicks open ItemDetailModal
```

Quest data is not part of the shared `(data)/layout.tsx` context. Pages that need quest data fetch it server-side. The quests page derives `traders` and `allMaps` from the loaded full quest data; it does not currently need `getCachedTraders()`.

---

## Quest Ordering

`orderQuestsByPrerequisites()` in `src/server/services/quests.ts`:

- Computes `prerequisiteDepth` as the longest prerequisite chain depth.
- Breaks cycles with a `visiting` guard set.
- Sorts by `prerequisiteDepth`, then `minPlayerLevel`, then `name`.

The sorted order is load-bearing for `QuestsTree`, which uses same-trader prerequisite order to assign a primary parent in each trader tree.

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

playerLevel: number;
prestigeLevel: number;
questFaction: "USEC" | "BEAR" | null;
questTraderLoyaltyLevels: Record<string, number>;

questViewMode: "list" | "byTrader" | "tree";
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
- `failureMap`: inverted task-status fail-condition index for mutually exclusive branches.
- `kappaQuestIds` / `lightkeeperQuestIds`: transitive prerequisite closures.
- `filteredQuests`: active filters and local search applied in order.
- `traders` and `allMaps`: deduped filter lists derived from full quest data.
- Manual sync helpers that call `quest-sync.ts` and write results back to `useUserStore`.

---

## Search & Filters

`QuestsSearchBar` stores immediate input locally and debounces writes to `QuestsContext.searchQuery`. `filteredQuests` matches search text against quest name, trader name, and map name after the persisted filters are applied.

The page supports filters for completion, availability, hand-in objectives, FiR hand-ins, pinned quests, ignored quests, kappa/LK quest chains, selected traders, selected maps, faction, player level, prestige, and trader loyalty.

---

## State Subscription & Performance Notes

The quest page is render-heavy, especially in tree mode. Prefer Zustand selectors over bare `useUserStore()`:

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
| Tree                             | `QuestsTree.tsx` | Trader grouping, tree metadata, `buildTraderTree()` |
| By Trader                        | `QuestsList.tsx` | Trader grouping and chain sorting                   |
| By Map (`questViewMode: "list"`) | `QuestsList.tsx` | Map grouping and chain sorting                      |

---

## Manual Quest Sync

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
- Candidate inference scans quests from the selected trader.
- Cross-trader prerequisites may be backfilled for a selected-trader inferred candidate only when completing those prerequisites is the sole reason that candidate was unavailable.
- If any other blocker remains, such as player level, faction, prestige, trader loyalty, or missing same-trader prerequisite state, no cross-trader backfill is written for that candidate.
- `blockedSensitiveQuestIds` identifies sensitive prerequisite chains that need a user decision before syncing.

Focused sync tests are not wired to an npm script:

```bash
node --test --import jiti/register src/features/quests/quest-sync.test.ts
```

Run this when changing manual sync behavior before `npm run lint` and `npm run build`.

---

## QuestCard Anatomy

`QuestCard.tsx` renders:

- Completion, pin, ignore, and have-items controls backed by `useUserStore`.
- Failed and disabled quest states for fail-capable mutually exclusive branches.
- Trader avatar, quest name, level/map/kappa/LK/faction/trader-loyalty/prestige badges.
- Compact item strip for `giveItem` objectives; item thumbnails call `onItemClick(itemId)`.
- Expanded objective rows for all objective types.
- Requires/unlocks chips linked to `#quest-{id}`.
- Optional debug JSON when `questShowDebug` is enabled.

API quirks to keep in mind:

| Field                                    | Quirk                                   | Correct handling                                             |
| ---------------------------------------- | --------------------------------------- | ------------------------------------------------------------ |
| `quest.factionName`                      | Returns `"Any"` for unrestricted quests | Only render faction badge for exactly `"USEC"` or `"BEAR"`   |
| `quest.minPlayerLevel`                   | Can be `0` or `null`                    | Check `!= null` instead of truthiness                        |
| `quest.trader.imageLink` / `image4xLink` | Can be `null` or `undefined`            | Normalize to `null` where a stable reference shape is needed |

---

## Caching

| Layer                    | Key                                      | Freshness                   |
| ------------------------ | ---------------------------------------- | --------------------------- |
| Redis                    | `quests:full:v4` + `quests:full:v4:meta` | 12h service freshness check |
| Next.js `unstable_cache` | `["quests-full"]`                        | `revalidate: 43200`         |

To invalidate quest data for application code, bump the relevant version in `src/lib/cfg/cacheVersions.ts`. See `caching-architecture.md`.

---

## Planned Work

Graph view remains a future feature: a pannable/zoomable graph showing the full quest dependency chain. A likely implementation would use React Flow (`@xyflow/react`) with Dagre for layout and should respect the active `filteredQuests` set.
