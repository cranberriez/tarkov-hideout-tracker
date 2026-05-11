# Quests Page

The `/quests` route displays item requirements for all Tarkov quests, filtered to `giveItem` objectives only. It is a read-only reference — no progress is tracked client-side.

---

## Route & Files

| File | Role |
|---|---|
| `src/app/(data)/quests/page.tsx` | Server component — fetches quest + trader data, orders quests, renders `QuestsClientPage` |
| `src/features/quests/QuestsClientPage.tsx` | Client component — filtering, sorting, and rendering the quest list |
| `src/features/quests/QuestCard.tsx` | Individual quest card with item requirements, trader, prerequisites, and leads-to |
| `src/server/services/quests.ts` | `getCachedQuestData()` + `orderQuestsByPrerequisites()` |
| `src/server/services/traders.ts` | `getCachedTraders()` |

---

## Data Flow

```
/quests page (server component)
  → getCachedQuestData()   → Redis quests:all:v3 → Tarkov.dev GraphQL (on miss)
  → getCachedTraders()     → Redis traders:all:v1 → Tarkov.dev GraphQL (on miss)
  → orderQuestsByPrerequisites(quests)
  → <QuestsClientPage quests={ordered} traders={traders} updatedAt={...} />
```

Quest and trader data are passed directly as props — no React context is involved.

---

## Quest Ordering

`orderQuestsByPrerequisites` computes a topological sort using recursive memoized depth calculation:

- **prerequisiteDepth** = longest prerequisite chain length (0 for quests with no prerequisites)
- Cycles are broken with depth 0 (cycle guard via a `visiting` set)
- Missing prerequisite IDs are treated as depth 0

Sort order: `prerequisiteDepth` → `minPlayerLevel` → `name` (alphabetical).

---

## Filters (Client-Side)

| Control | Behavior |
|---|---|
| Trader dropdown | Multi-select; hides quests not assigned to a selected trader. All shown when nothing selected. |
| Level input | Numeric field (1–100); currently displayed but not used to hide quests (reserved for future level-gating UI) |

The selected trader count is shown on the dropdown trigger: `Trader (2)`.

---

## Quest Card

Each `QuestCard` shows:
- Quest name (links to wiki if `wikiLink` present)
- Trader name + avatar (`image4xLink`)
- Minimum player level badge
- Item requirements (icon, name, count, FiR badge)
- Prerequisites list (names of quests that must be completed first)
- Leads-to list (quests that have this quest as a prerequisite — computed client-side from the full quest graph)

---

## State

No Zustand state. No localStorage persistence. All filtering is local React state in `QuestsClientPage`:

```ts
const [playerLevel, setPlayerLevel] = useState<number>(1);
const [selectedTraders, setSelectedTraders] = useState<Set<string>>(() => new Set());
```

Client-side derived maps:
- `tradersByNormalizedName: Map<string, QuestsClientTrader>` — for O(1) trader lookup per card
- `questsById: Map<string, QuestsClientQuest>` — for resolving prerequisite and leads-to names
- `leadsToByQuestId: Map<string, string[]>` — inverted prerequisite index for "leads to" display

---

## Caching

| Layer | Key | TTL |
|---|---|---|
| Redis | `quests:all:v3` + `quests:all:v3:meta` | 12h (freshness check via meta timestamp) |
| Redis | `traders:all:v1` + `traders:all:v1:meta` | 12h |
| Next.js `unstable_cache` | cache key `["quests"]` / `["traders"]` | `revalidate: 43200` (12h) |

On a Redis cache miss, `getQuestData()` / `getTraders()` call Tarkov.dev GraphQL and write the result back to Redis. On a Redis hit within 12h, the GraphQL call is skipped entirely.

To invalidate: bump the Redis key version (`v3` → `v4`) or delete the key directly in Upstash.

---

## Planned Features

### Items Needed Panel

A floating sidebar docked to the right of the quest list showing aggregated item requirements across all visible, incomplete quests. Two sections:

| Section | Definition |
|---|---|
| **Items Needed (Now)** | Items from quests that are currently *available* (prereqs met, player level met) and are neither completed nor marked "Have Items" |
| **Items Needed (Future)** | Items from quests that are *locked*, within a configurable look-ahead depth |

**Look-ahead depth** controls how far into the locked quest chain future items are pulled. Depth 1 = only quests one prerequisite step away from an available quest. Depth 2 = two steps. A small button in the Future section header cycles through depths 1–5.

**"Have Items" state** — `questsWithItems: Record<string, boolean>` in `useUserStore` (persisted). Marking a quest as "Have Items" signals the player has the items but hasn't handed them in. Such quests are excluded from both panel sections (items not shown as needed). The quest itself is not considered completed in the quest display — not dimmed, not hidden by "Hide Completed" — and shows a blue left-border status indicator.

**Item aggregation rules:**
- Same item across multiple quests → sum counts
- FiR flag shown if any matching objective requires Found In Raid
- Panel is independent of sidebar filters and collapses separately

---

### Text Search

A search input in the filter bar row that filters quest names after all other active filters.

**Controls:**
- Search input: case-insensitive substring match on quest name, applied in real time
- **ALL toggle** adjacent to the input: bypasses all other active filters and searches the full quest list; automatically deactivates when the input is cleared

**Behavior:**
- Search is the last filter applied — after trader, map, faction, Kappa/LK, hide-completed, and available-only
- Debounce ~150ms to avoid layout thrashing while typing
- ALL mode is ephemeral: overrides filters only while the input has a value; clearing the input restores the previous filter state without toggling anything
