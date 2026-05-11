# Quest Completion Filtering — Refactor Plan

Refactor quest item pooling to support live filtering by player quest completion state, while keeping server-side pooling cached.

---

## Core Idea

The server currently pools all quests into one flat `QuestPoolItem[]`, losing per-quest identity before the client ever sees it. The fix: pool each quest individually on the server (`PerQuestPool[]`), pass that structure to the client, and let the client filter by `completedQuests` and re-merge cheaply.

```
Before:
  Server: quests[] → poolQuestItems() → QuestPoolItem[]  →  client
                                         ↑ identity lost

After:
  Server: quests[] → poolQuestItemsPerQuest() → PerQuestPool[]  →  client
  Client: perQuestPools.filter(not completed) → merge → merged pool
```

The expensive pooling work is still cached server-side (Redis 12h + Next.js `unstable_cache`). The client merge is O(n) and runs reactively when `completedQuests` changes.

---

## Changes

### 1. `src/lib/utils/quest-pooling.ts`

Add `PerQuestPool` interface, `poolQuestItemsPerQuest`, and `mergePerQuestPools`. Keep `poolQuestItems` working as a one-liner on top so existing callers aren't broken.

```ts
export interface PerQuestPool {
    questId: string;
    items: QuestPoolItem[];
}

export function poolQuestItemsPerQuest(quests: Quest[]): PerQuestPool[] {
    return quests.map((quest) => {
        const map = new Map<string, QuestPoolItem>();
        for (const objective of quest.objectives) {
            for (const item of objective.items) {
                const existing = map.get(item.id);
                if (existing) {
                    existing.count += objective.count;
                    if (objective.foundInRaid) existing.firCount += objective.count;
                } else {
                    map.set(item.id, {
                        id: item.id,
                        name: item.name,
                        normalizedName: item.normalizedName,
                        iconLink: item.iconLink,
                        gridImageLink: item.gridImageLink,
                        count: objective.count,
                        firCount: objective.foundInRaid ? objective.count : 0,
                    });
                }
            }
        }
        return { questId: quest.id, items: Array.from(map.values()) };
    });
}

export function mergePerQuestPools(
    perQuestPools: PerQuestPool[],
    completedQuests: Record<string, boolean>,
): QuestPoolItem[] {
    const map = new Map<string, QuestPoolItem>();
    for (const { questId, items } of perQuestPools) {
        if (completedQuests[questId]) continue;
        for (const item of items) {
            const existing = map.get(item.id);
            if (existing) {
                existing.count += item.count;
                existing.firCount += item.firCount;
            } else {
                map.set(item.id, { ...item });
            }
        }
    }
    return Array.from(map.values());
}

// Keep for backward compat — quests page still uses this
export function poolQuestItems(quests: Quest[]): QuestPoolItem[] {
    return mergePerQuestPools(poolQuestItemsPerQuest(quests), {});
}
```

---

### 2. `src/app/(data)/items/page.tsx`

Swap `poolQuestItems` for `poolQuestItemsPerQuest`. Still runs inside the `unstable_cache` boundary so it's cached.

```ts
import { poolQuestItemsPerQuest } from "@/lib/utils/quest-pooling";

export default async function ItemsPage() {
    const questsResponse = await getCachedQuestData();
    const perQuestPools = poolQuestItemsPerQuest(questsResponse.data.quests);
    return <ItemsClientPage perQuestPools={perQuestPools} />;
}
```

---

### 3. `src/lib/stores/useUserStore.ts`

Add `completedQuests` following the exact same pattern as `completedRequirements`. No store version bump needed — new key with empty default is backward-compatible with existing persisted state.

```ts
// Interface
completedQuests: Record<string, boolean>;
toggleQuestCompletion: (questId: string) => void;

// Initial state
completedQuests: {},

// Action
toggleQuestCompletion: (questId) =>
    set((state) => ({
        completedQuests: {
            ...state.completedQuests,
            [questId]: !state.completedQuests[questId],
        },
    })),

// resetAll
completedQuests: {},
```

---

### 4. `src/features/items/ItemsClientPage.tsx`

Update the prop type and thread `perQuestPools` through to `ItemsList` and `ItemsStatsRow`.

```ts
// Old
interface ItemsClientPageProps { questPoolItems: QuestPoolItem[] }
// New
interface ItemsClientPageProps { perQuestPools: PerQuestPool[] }
```

---

### 5. `src/features/items/components/ItemsList.tsx`

Replace `questPoolItems: QuestPoolItem[]` prop with `perQuestPools: PerQuestPool[]`. Read `completedQuests` from the store and call `mergePerQuestPools` inside a `useMemo` — it becomes reactive to completion changes automatically. Everything downstream (the hideout merge loop, filtering, sorting) stays identical.

```ts
// Old
const { questPoolItems } = props;

// New
const { completedQuests } = useUserStore();

const activeQuestItems = useMemo(
    () => mergePerQuestPools(perQuestPools, completedQuests),
    [perQuestPools, completedQuests],
);
// Use activeQuestItems everywhere questPoolItems was used
```

Add `completedQuests` to the `mergedPool` useMemo dependency array.

---

### 6. `src/features/items/components/ItemsStatsRow.tsx`

Same prop swap and `mergePerQuestPools` call as `ItemsList`. Stats will reactively exclude completed quests.

---

## What Doesn't Change

- Redis caching layer — `getCachedQuestData` and `getQuestData` are untouched
- Hideout pooling (`poolItems`) — untouched
- `ItemsControls` — untouched
- Quests page — still calls `poolQuestItems`, which now delegates to the new functions

---

## Follow-on: Quest Completion UI

### Wiring the quests page to the store

`QuestsClientPage` currently holds no Zustand state. To hook quest completion into items page filtering:

**1. Read and toggle completion in `QuestCard` (or `QuestsClientPage`)**

```ts
import { useUserStore } from "@/lib/stores/useUserStore";

const { completedQuests, toggleQuestCompletion } = useUserStore();
```

Render a checkbox / toggle per quest card and call `toggleQuestCompletion(quest.id)` on change. Because `completedQuests` is persisted to localStorage, the items page will reactively exclude completed quests with no additional wiring — `mergePerQuestPools` already skips any `questId` present in `completedQuests`.

**2. Visual state**

Use `completedQuests[quest.id]` to show a completed style on the card (dimmed, strikethrough name, checkmark badge, etc.).

---

### Available-quests filter (optional follow-on)

When a "show available only" toggle is desired on the items page, filter `perQuestPools` before passing to `mergePerQuestPools`:

```ts
const availablePools = perQuestPools.filter(({ questId }) => {
    const quest = questsById[questId];
    return quest?.taskRequirements.every((req) => completedQuests[req.task.id]);
});
```

This requires passing `questsById` (or a lookup map) to wherever the filtering happens. The items page server component would need to pass `perQuestPools` alongside a minimal `questsById` map, or the filter could live in `QuestsClientPage` and write a derived "available quest IDs" set to a shared store slice.
