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
