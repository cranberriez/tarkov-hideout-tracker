# Item Checklist — Source Filtering & Quest View Mode

Design notes for filtering the item list by source (hideout / quest / both) and adding a quest-specific view mode toggle.

---

## Source Filter

### What it controls

A three-way toggle that limits which items appear in the list:

| Value | Shows |
|---|---|
| `"all"` (default) | Every item needed — hideout + quest combined |
| `"hideout"` | Only items with `isHideout: true` |
| `"quest"` | Only items with `isQuest: true` |

Items needed for **both** sources always appear in `"all"` mode. In `"hideout"` or `"quest"` mode only the matching flag is checked — a combined item shows under both individual filters.

### State

Add to `useUserStore`:

```ts
itemSourceFilter: "all" | "hideout" | "quest"  // default "all"
setItemSourceFilter: (v: "all" | "hideout" | "quest") => void
```

Include in the localStorage persist whitelist.

### Filtering logic in `ItemsList`

Apply after merging the pool, before the price/FiR filters:

```ts
if (itemSourceFilter === "hideout") {
    finalItems = finalItems.filter((i) => i.isHideout);
} else if (itemSourceFilter === "quest") {
    finalItems = finalItems.filter((i) => i.isQuest);
}
// "all" — no filter applied
```

Order: source filter → `showFirOnly` → `hideCheap` → sort.

### UI

A segmented control in `ItemsControls` next to the existing view-mode toggle. Three buttons: `All`, `Hideout`, `Quests`.

---

## Quest View Mode

### Concept

Mirrors the hideout "all future / next level" toggle but operates on quest prerequisite depth instead of station levels. Controls how many quests contribute items to the pool.

| Value | Meaning |
|---|---|
| `"all"` (default) | Pool items from every quest regardless of where it sits in the prerequisite chain |
| `"available"` | Pool items only from quests the player can currently start (all prerequisites met — requires quest completion state, implement later) |

Because quest completion tracking doesn't exist yet, `"available"` is a future mode. For now, only `"all"` is functional. Document the toggle shape now so the state slot is ready.

### State

Add to `useUserStore`:

```ts
questViewMode: "all" | "available"  // default "all"
setQuestViewMode: (v: "all" | "available") => void
```

Include in the localStorage persist whitelist.

### Filtering logic in `poolQuestItems` (or at the call site)

When `questViewMode === "available"`, filter the quests array before pooling:

```ts
// Future — requires completedQuests: Set<string> in useUserStore
const visibleQuests = questViewMode === "available"
    ? quests.filter((q) =>
          q.taskRequirements.every((r) =>
              r.status.every((s) => s === "complete") &&
              completedQuests.has(r.task.id)
          )
      )
    : quests;

return poolQuestItems(visibleQuests);
```

Since `poolQuestItems` currently runs server-side (in the page component), moving this filter to the client will be needed when `questViewMode` drives it. The simplest path: pass the full `questPoolItems` array to the client but also pass per-quest metadata (quest ID + prerequisite list) so the client can re-pool dynamically based on the toggle. Alternatively, pre-pool per-quest and merge on the client.

### UI

A two-button toggle in `ItemsControls`, visible only when `itemSourceFilter` is `"all"` or `"quest"`:
`All Quests` / `Available` (grayed out with tooltip "coming soon" until quest tracking is implemented).

---

## Implementation Order

1. Add `itemSourceFilter` to `useUserStore` + UI toggle → source filtering works immediately since `isHideout` / `isQuest` flags are already on every pooled item.
2. Add `questViewMode` state slot to `useUserStore` (no-op for now, just `"all"`).
3. When quest completion tracking ships: wire `questViewMode === "available"` filter into the pool.
