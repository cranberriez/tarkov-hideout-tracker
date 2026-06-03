# Quest Cascade & Conservative Manual Sync — Design

**Date:** 2026-05-17
**Branch:** `quests`
**Related docs:** [docs/quests-page.md](../../quests-page.md)

## Problem

Manual sync infers some quests as completed when it shouldn't. When the inference loop in [src/features/quests/quest-sync.ts](../../../src/features/quests/quest-sync.ts) considers a candidate quest from the synced trader and finds it is blocked *only* by an incomplete cross-trader prerequisite, it speculatively marks that cross-trader prerequisite complete and then marks the candidate complete. This is a guess, not an inference grounded in any anchor the user selected, and produces false positives: chains of two same-trader quests get inferred correctly, the third one in the chain requires a cross-trader quest the user has not done, and both the cross-trader prereq and the candidate are marked complete anyway.

## Goals

1. Make manual sync conservative: no speculative cross-trader writes during inference.
2. Replace the lost convenience with an explicit, user-driven cascade triggered by the QuestCard completion checkbox.
3. Guard the cascade with a confirmation dialog when the action is large or cross-trader, so the user always sees what is about to change before destructive or surprising state writes happen.
4. Extract the trader-grouped quest list into a reusable component shared by the new dialog and both existing sync dialogs.

## Non-Goals

- Changing quest log import behavior.
- Changing the anchor-prerequisite walk in manual sync (those writes are necessary given the user's selection, not speculative).
- Adding cross-trader inference back in any form.

## Design

### A. Conservative manual sync

In [src/features/quests/quest-sync.ts](../../../src/features/quests/quest-sync.ts):

- Delete `getCrossTraderBackfillIdsThatMakeQuestAvailable`.
- In the inference loop (currently lines 233–289), remove the cross-trader backfill branch. A same-trader candidate becomes inferred-complete only when `isQuestAvailableForProfile(quest, syncProfile, questAvailabilityById)` returns true against the current `nextCompletedQuests`. No speculative writes.
- Remove the `inferOtherTraderChains` parameter from `SyncTraderProgressInput` and all call sites. Same-trader inference always runs; cross-trader inference is gone entirely.
- Keep `collectTransitivePrerequisiteIds` walking across traders for the *anchor* prerequisites. These are not speculative: the user picked a quest visible in game, so its prerequisites are genuinely done.
- Keep the sensitive-backfill machinery ([src/lib/utils/sensitive-quest-backfill.ts](../../../src/lib/utils/sensitive-quest-backfill.ts)) and its UI inside `QuestSyncTraderStep`. It still gates the anchor-prereq walk, which still crosses traders.
- `SyncTraderProgressInput` keeps `allowedSensitiveBackfillQuestIds` and `deniedSensitiveBackfillQuestIds` since the anchor-prereq walk still uses them.

### B. Quest cascade module

New pure module `src/features/quests/quest-cascade.ts`:

```ts
export interface QuestCascadeCompleteResult {
    toComplete: string[];              // includes the root if not already complete
    crossTraderQuestIds: string[];     // subset of toComplete from a different trader than root
    sensitiveQuestIds: string[];       // subset of toComplete in SENSITIVE_BACKFILL_QUESTS
}

export interface QuestCascadeUncompleteResult {
    toUncomplete: string[];            // includes the root
    crossTraderQuestIds: string[];
}

export function collectCompleteCascade(
    rootQuestId: string,
    ctx: {
        questsById: ReadonlyMap<string, FullQuest>;
        completedQuests: Record<string, boolean>;
    },
): QuestCascadeCompleteResult;

export function collectUncompleteCascade(
    rootQuestId: string,
    ctx: {
        questsById: ReadonlyMap<string, FullQuest>;
        completedQuests: Record<string, boolean>;
        leadsToByQuestId: ReadonlyMap<string, ReadonlySet<string>>;
    },
): QuestCascadeUncompleteResult;
```

`collectCompleteCascade` walks `quest.taskRequirements` recursively, skipping ids already in `completedQuests`. Profile checks (level/faction/loyalty) are intentionally ignored — the user is asserting "I did this."

`collectUncompleteCascade` walks `leadsToByQuestId` recursively, collecting only ids currently in `completedQuests`. `leadsToByQuestId` already exists in `QuestsContext`.

`crossTraderQuestIds` is computed relative to the root quest's trader.

### C. Confirm dialog

New component `src/features/quests/components/QuestCascadeConfirmDialog.tsx`. Opened via new `useUIStore` state:

```ts
interface QuestCascadeRequest {
    mode: "complete" | "uncomplete";
    rootQuestId: string;
    questIds: string[];                // toComplete or toUncomplete
    crossTraderQuestIds: string[];
    sensitiveQuestIds: string[];       // empty for uncomplete
}

questCascadeRequest: QuestCascadeRequest | null;
openQuestCascadeRequest(request: QuestCascadeRequest): void;
closeQuestCascadeRequest(): void;
```

Trigger rules in `QuestsContext.requestToggleQuestCompletion(questId)`:

- **Toggling to complete**: compute `collectCompleteCascade`. Open dialog when any of the following hold:
  - `crossTraderQuestIds.length > 0`
  - `toComplete.length > 10`
  - `sensitiveQuestIds.length > 0`
- **Toggling to uncomplete**: compute `collectUncompleteCascade`. Open dialog when `toUncomplete.length > 1` (anything downstream is currently complete). Otherwise just uncomplete the root.

When no trigger fires, apply silently via the new store action.

Dialog content:
- Header summarizing the action: e.g. "Mark 14 quests as complete" or "Uncomplete 8 quests".
- Sub-line callouts when applicable: "3 quests from other traders", "Includes sensitive backfill: Network Provider — Part 1".
- The reusable `QuestListByTrader` component (see D) showing the full list grouped by trader.
- Confirm and Cancel buttons. Confirm calls the bulk store action; Cancel closes the dialog with no state change.

### D. Reusable `QuestListByTrader`

New component `src/features/quests/components/QuestListByTrader.tsx`:

```ts
interface QuestListByTraderProps {
    questIds: string[];
    questsById: ReadonlyMap<string, FullQuest>;
    highlightQuestIds?: ReadonlySet<string>;  // e.g. cross-trader or sensitive ids
    emptyMessage?: string;
}
```

Renders a deduped, trader-grouped list with trader avatar/name headings and quest names underneath. No interactivity. Used in:

1. `QuestCascadeConfirmDialog` (new).
2. `QuestSyncDialog` / `QuestSyncTraderStep` — replaces the current preview/result rendering of completed quest ids.
3. `QuestLogImportDialog` — replaces the current preview/result rendering.

The two existing sync dialogs are migrated to the shared component in the same change, so we validate the API works for all three use cases.

### E. Store changes

New action on `useUserStore`:

```ts
applyQuestCompletionChange({ complete = [], uncomplete = [] }: {
    complete?: string[];
    uncomplete?: string[];
}): void;
```

Single `set()` that merges both into `completedQuests`. Clears `questsWithItems[id]` for every id in `complete` (mirrors existing `toggleQuestCompletion`).

`toggleQuestCompletion` is kept for cases that bypass the cascade (none today after this change; the existing call sites in QuestCard route through the context instead). Reset paths in `useUserStore` are unchanged.

### F. QuestCard wiring

`QuestCard.tsx` stops calling `toggleQuestCompletion` directly. It calls a new context method:

```ts
QuestsContext.requestToggleQuestCompletion(questId: string): void;
```

The context computes the cascade and either dispatches `applyQuestCompletionChange` directly or opens the dialog via `useUIStore`. Dialog confirmation also calls `applyQuestCompletionChange` (the dialog reads `questCascadeRequest` from `useUIStore` and the store action from `useUserStore` directly; it does not depend on `QuestsContext`).

## Files Changed

| File | Change |
| --- | --- |
| `src/features/quests/quest-sync.ts` | Remove cross-trader backfill and `inferOtherTraderChains` param |
| `src/features/quests/quest-sync.test.ts` | Drop cross-trader inference cases; add regression test for the reported bug |
| `src/features/quests/quest-cascade.ts` | New module |
| `src/features/quests/quest-cascade.test.ts` | New tests for cascade collection |
| `src/features/quests/components/QuestCascadeConfirmDialog.tsx` | New component |
| `src/features/quests/components/QuestListByTrader.tsx` | New reusable component |
| `src/features/quests/components/QuestSyncDialog.tsx` (and `QuestSyncTraderStep.tsx`) | Migrate result rendering to `QuestListByTrader`; drop `inferOtherTraderChains` toggle if present |
| `src/features/quests/components/QuestLogImportDialog.tsx` | Migrate preview/result to `QuestListByTrader` |
| `src/features/quests/QuestsContext.tsx` | Add `requestToggleQuestCompletion`; update sync call to drop `inferOtherTraderChains` |
| `src/features/quests/QuestCard.tsx` | Route checkbox through `requestToggleQuestCompletion` |
| `src/lib/stores/useUserStore.ts` | Add `applyQuestCompletionChange` action |
| `src/lib/stores/useUIStore.ts` | Add `questCascadeRequest` state and open/close actions |

## Edge Cases

- **Cycles in prerequisites.** `quest-cascade.ts` uses a visited set in both directions.
- **Unknown quest id.** Skipped (matches existing patterns in `collectTransitivePrerequisiteIds`).
- **Root already complete on a "complete" click.** The cascade returns `{ toComplete: [], ... }`; the toggle is treated as an uncomplete instead (matches current `toggleQuestCompletion` semantics).
- **Uncomplete root with no completed downstream.** Apply silently (just the root).
- **Sensitive quest as the root of a complete cascade.** Always open the dialog regardless of size or cross-trader status.

## Testing

- `node --test --import jiti/register src/features/quests/quest-sync.test.ts`
- `node --test --import jiti/register src/features/quests/quest-cascade.test.ts`
- `npm run lint`
- `npm run build`
- Manual dev-server verification:
  - Manual sync the reported chain; confirm the third quest is no longer inferred when its cross-trader prereq is incomplete.
  - Check a quest with no missing prereqs — no dialog.
  - Check a quest with 3 same-trader missing prereqs — no dialog.
  - Check a quest with 1 cross-trader missing prereq — dialog opens.
  - Check a quest with 15 same-trader missing prereqs — dialog opens.
  - Check Network Provider Part 1 — dialog opens.
  - Uncheck a quest with no dependents — no dialog.
  - Uncheck a quest with completed dependents — dialog opens.
  - Verify the same `QuestListByTrader` renders in QuestSyncDialog and QuestLogImportDialog.

## Rollout

Single change on the `quests` branch. No data migration: the cascade reads and writes the existing `completedQuests` shape.
