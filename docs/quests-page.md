# Quests Page

The `/quests` route displays quest data from Tarkov.dev — objectives, prerequisites, unlock chains, completion tracking. Three view modes: **List**, **By Trader**, **Tree**.

---

## Route & Files

| File | Role |
|---|---|
| `src/app/(data)/quests/page.tsx` | Server component — fetches quest data, passes to `QuestsClientPage` |
| `src/features/quests/QuestsClientPage.tsx` | Client shell — mobile sidebar toggle, `QuestsProvider` wrapper, renders `QuestsContent` |
| `src/features/quests/QuestsContext.tsx` | React context + provider — all filter state, derived maps, filter logic |
| `src/features/quests/QuestCard.tsx` | Individual quest card — badges, objectives, chips, completion toggle |
| `src/features/quests/components/QuestsList.tsx` | Flat list and "By Trader" grouped views |
| `src/features/quests/components/QuestsTree.tsx` | Tree view — per-trader trees with collapsible branches |
| `src/features/quests/components/QuestsSidebar.tsx` | Filter sidebar — trader + map multi-select |
| `src/features/quests/components/QuestsCharacterBar.tsx` | Player level, prestige, faction toggles |
| `src/features/quests/components/QuestsFilterBar.tsx` | View mode (List / By Trader / Tree), Hide Completed, Available Only |
| `src/features/quests/components/quest-ui.tsx` | Shared UI primitives: `SidebarLabel`, `SidebarToggle`, `SegButton`, `FilterButton`, `Divider` |
| `src/server/services/quests.ts` | `getCachedFullQuestData()` + `orderQuestsByPrerequisites()` |
| `src/server/services/traders.ts` | `getCachedTraders()` (traders list for sidebar) |
| `src/lib/utils/quest-pooling.ts` | Item aggregation utilities across quests |

---

## Data Flow

```
/quests page (server component)
  → getCachedFullQuestData()   → Redis quests:full:v3 → Tarkov.dev GraphQL (on miss)
  → orderQuestsByPrerequisites(quests)   (topological sort)
  → <QuestsClientPage quests={ordered} />
      → <QuestsProvider>         (QuestsContext: filter state, derived maps)
          → <QuestsContent>      (reads viewMode, renders QuestsList or QuestsTree)
```

---

## Quest Ordering (server-side)

`orderQuestsByPrerequisites` in `src/server/services/quests.ts`:

- Computes `prerequisiteDepth` = longest prerequisite chain (0 for root quests)
- Cycles broken by a `visiting` guard set (treated as depth 0)
- Sort order: `prerequisiteDepth` → `minPlayerLevel` → `name`

The sorted order is load-bearing: `QuestsTree` uses array index as a proxy for depth when assigning each quest its primary same-trader parent.

---

## State

Quest filter and view preferences live in **`useUserStore`** (Zustand, persisted to localStorage):

```ts
questViewMode: "list" | "byTrader" | "tree";
questSelectedTraders: string[];
questFaction: "USEC" | "BEAR" | null;
questShowKappa: boolean;
questShowLightkeeper: boolean;
questSelectedMaps: string[];
questHideCompleted: boolean;
questShowAvailableOnly: boolean;

completedQuests: Record<string, boolean>;   // toggled per card
playerLevel: number;
prestigeLevel: number;
```

**`QuestsContext`** wraps the store values and computes:
- `questsById: Map<string, FullQuest>` — O(1) quest lookup
- `leadsToByQuestId: Map<string, string[]>` — inverted prerequisite index
- `kappaQuestIds / lightkeeperQuestIds: Set<string>` — transitive prerequisite closure
- `filteredQuests` — applies all active filters in order
- `traders`, `allMaps` — deduped lists for sidebar

---

## QuestCard Anatomy

**File:** `src/features/quests/QuestCard.tsx`

### Header row (always visible)

| Element | Source field | Notes |
|---|---|---|
| Completion circle | `completedQuests[quest.id]` from store | Toggles `toggleQuestCompletion` on click |
| Trader avatar | `quest.trader.image4xLink ?? quest.trader.imageLink` | Falls back to initial letter |
| Quest name | `quest.name` | Strikethrough + dimmed when completed |
| Level badge | `quest.minPlayerLevel` | Hidden if null |
| Map badge | `quest.map.name` | Hidden on small screens (`hidden sm:inline`) |
| Kappa badge (κ) | `quest.kappaRequired === true` | |
| Lightkeeper badge (LK) | `quest.lightkeeperRequired === true` | |
| Faction badge | `quest.factionName === "USEC" \| "BEAR"` | **See API quirks below** |
| Trader loyalty badge | `quest.traderRequirements[]` | Shows `{trader.name} LL{value}` per entry |
| Prestige badge | `quest.requiredPrestige` | Shows `P{prestigeLevel}` |
| Debug JSON toggle | local `debugOpen` state | Braces icon, far right |
| Expand chevron | local `expanded` state | |

### Compact item strip (collapsed, only if has giveItem objectives)

Shows up to 10 item icons from `giveItem` objectives. Orange ring = FiR. Orange dot on icon corner = FiR.

### Expanded section

| Section | Source | Rendered by |
|---|---|---|
| Objectives | `quest.objectives[]` | `ObjectiveRow` with `ObjectiveIcon` per type |
| Requires chips | `quest.taskRequirements[]` resolved via `questsById` | `QuestChip` — links to `#quest-{id}` |
| Unlocks chips | `leadsToByQuestId.get(quest.id)` resolved via `questsById` | `QuestChip` — links to `#quest-{id}` |
| XP | `quest.experience` | Footer left |
| Map name | `quest.map.name` | Footer right |
| Wiki link | `quest.wikiLink` | Footer right, opens in new tab |

### QuestChip

Defined in `QuestCard.tsx`, exported as `QuestChip`. Renders a clickable anchor chip with:
- Trader avatar (14px circle)
- Quest name
- `href="#quest-{id}"` for native scroll-to

`QuestRef` type (also exported from `QuestCard.tsx`) is what chips and tree nodes pass around:
```ts
interface QuestRef {
    id: string;
    name: string;
    trader: { imageLink: string | null; image4xLink: string | null; name: string };
}
```

### Left-border status indicator

| State | Class |
|---|---|
| Available (prereqs met, level met) | `border-l-2 border-l-tarkov-green/50` |
| Locked | `border-l-2 border-l-amber-500/30` |
| Completed | `border-white/5 bg-black/10` (no colored left border) |

---

## QuestsTree — Tree View

**File:** `src/features/quests/components/QuestsTree.tsx`

Displays quests grouped by trader. Within each trader section, quests are nested by their same-trader prerequisite chain.

### Tree building algorithm (`buildTraderTree`)

For each trader's quests (in the server-sorted order):
1. Build `traderQuestIds` set
2. For each quest, find all `taskRequirements` that are in the same trader set
3. If none → root node. If any → primary parent = the one with the **highest index** in the sorted array (deepest in chain)
4. Build `childrenOf: Map<questId, questId[]>` and `rootIds: string[]`

Cross-trader prerequisites still appear as `QuestChip`s in the card's Requires section — the tree only uses same-trader prereqs for nesting.

### Connector lines

Each child in a children group gets an absolutely-positioned bar segment inside a `relative pl-5` wrapper:

- **Non-last children:** `top: -4px, bottom: 0` — extends 4px above the wrapper to bridge the `mt-1` card gap, giving a visually continuous line through the sibling group
- **Last child:** `top: 0, height: CONNECTOR_Y px` — terminates at the horizontal connector point, never hanging past the card
- Horizontal connector: `left: 8px, top: CONNECTOR_Y px, width: 12px` — L-bends from bar to card edge

`CONNECTOR_Y = 22` (px from wrapper top to card header mid-point, accounting for `mt-1` card offset).

### Collapsible groups

Each `QuestTreeNode` has `childrenCollapsed: boolean` state. The bar segments are `<button>` elements — clicking any segment calls `setChildrenCollapsed(true)` on the parent node. When collapsed, a `CollapseHint` row replaces the children:

```
─── 11 quests hidden · SHOW ───
```

The count is the **total descendant count** (recursive), not just direct children.

### Hover sync

All bar segments in one children group share `barHovered: boolean` state on the parent `QuestTreeNode`. Each segment's `onMouseEnter/onMouseLeave` sets this state with a 30ms debounce timer on leave (prevents flicker when the pointer moves between segments). The visual line and horizontal connector both read `barHovered` for their color class.

---

## API Data Quirks

These are Tarkov.dev GraphQL response values that don't mean what they look like:

| Field | Quirk | Correct handling |
|---|---|---|
| `quest.factionName` | Returns `"Any"` (string) for quests with no faction restriction — **not** `null` | Only render faction badge when value is exactly `"USEC"` or `"BEAR"` |
| `quest.minPlayerLevel` | Can be `0` or `null` for quests with no level requirement | Check `!= null` not falsy — `0` is valid |
| `quest.trader.imageLink` / `image4xLink` | Typed as `string \| null \| undefined` from GraphQL | Normalize to `null` with `?? null` before storing in `QuestRef` |

---

## Caching

| Layer | Key | TTL |
|---|---|---|
| Redis | `quests:full:v3` + `quests:full:v3:meta` | 12h freshness check |
| Next.js `unstable_cache` | `["quests-full"]` | `revalidate: 43200` (12h) |

To invalidate: bump the key version (`v3` → `v4`) or delete directly in Upstash.

---

## Planned Features

### Items Needed Panel

A floating sidebar showing aggregated item requirements across all visible, incomplete quests.

| Section | Definition |
|---|---|
| **Items Needed (Now)** | Items from quests that are currently available (prereqs met, level met), not completed, not marked "Have Items" |
| **Items Needed (Future)** | Items from locked quests within a configurable look-ahead depth (1–5 steps) |

**"Have Items" state** — `questsWithItems: Record<string, boolean>` in `useUserStore`. Marking a quest "Have Items" excludes it from both panel sections. Quest card shows a blue left-border indicator but is not considered completed.

### Text Search

Search input in the filter bar — case-insensitive substring match on quest name, applied after all other filters. Includes an **ALL toggle** that bypasses all other active filters while the input has a value, auto-clearing when input is emptied.

### Graph View

A pannable/zoomable graph showing the full quest dependency chain visually. Candidate library: React Flow (`@xyflow/react`) with Dagre for auto-layout. Should respect the active `filteredQuests` set rather than rendering all ~300 quests at once.
