# Quest Cascade & Conservative Manual Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix manual-sync false positives by removing cross-trader inference speculation, and add an explicit checkbox-driven cascade that completes/uncompletes prerequisite chains with a confirmation dialog for large or cross-trader actions.

**Architecture:** Surgical change to `src/features/quests/quest-sync.ts` (delete the cross-trader backfill branch in the inference loop). New pure module `src/features/quests/quest-cascade.ts` computing complete/uncomplete cascades from a single root quest. New `QuestCascadeConfirmDialog` opened via `useUIStore` and triggered by `QuestCard` through a new `QuestsContext.requestToggleQuestCompletion` method. New reusable `QuestListByTrader` component used by the new dialog, by `QuestSyncTraderStep`, and by `QuestLogImportDialog`. Single new store action `applyQuestCompletionChange` does the bulk write.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Zustand, Radix UI Dialog, node:test for tests.

**Spec:** [docs/superpowers/specs/2026-05-17-quest-cascade-and-conservative-sync-design.md](../specs/2026-05-17-quest-cascade-and-conservative-sync-design.md)

**Test command (used throughout):**
```bash
node --test --import jiti/register src/features/quests/quest-cascade.test.ts
node --test --import jiti/register src/features/quests/quest-sync.test.ts
```

---

## Task 1: Create `quest-cascade.ts` with `collectCompleteCascade`

**Files:**
- Create: `src/features/quests/quest-cascade.ts`
- Create: `src/features/quests/quest-cascade.test.ts`

The complete cascade walks `taskRequirements` recursively and collects every incomplete prerequisite, including the root if it is itself incomplete. Profile checks are intentionally NOT consulted — the user is asserting "I did this." A cycle guard is needed because the FullQuest graph has no documented acyclicity guarantee.

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/quests/quest-cascade.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import type { FullQuest } from "../../types/types";
import { collectCompleteCascade } from "./quest-cascade";
import { NETWORK_PROVIDER_PART_1_ID } from "../../lib/utils/sensitive-quest-backfill";

const prapor = { id: "prapor", name: "Prapor", normalizedName: "prapor", imageLink: null, image4xLink: null };
const therapist = { id: "therapist", name: "Therapist", normalizedName: "therapist", imageLink: null, image4xLink: null };

function makeQuest(overrides: Partial<FullQuest> & Pick<FullQuest, "id" | "name">): FullQuest {
    return {
        id: overrides.id,
        name: overrides.name,
        normalizedName: overrides.normalizedName ?? overrides.name.toLowerCase().replace(/\s+/g, "-"),
        experience: 1000,
        trader: overrides.trader ?? prapor,
        taskRequirements: overrides.taskRequirements ?? [],
        traderRequirements: [],
        requiredPrestige: null,
        objectives: [],
        wikiLink: null,
        minPlayerLevel: 1,
        kappaRequired: false,
        lightkeeperRequired: false,
        factionName: null,
        map: null,
    };
}

function buildQuestsById(quests: FullQuest[]) {
    return new Map(quests.map((quest) => [quest.id, quest]));
}

test("collectCompleteCascade returns just the root when there are no prereqs", () => {
    const quests = [makeQuest({ id: "root", name: "Root" })];
    const result = collectCompleteCascade("root", {
        questsById: buildQuestsById(quests),
        completedQuests: {},
    });

    assert.deepEqual(result.toComplete, ["root"]);
    assert.deepEqual(result.crossTraderQuestIds, []);
    assert.deepEqual(result.sensitiveQuestIds, []);
});

test("collectCompleteCascade walks transitive prereqs and skips already-complete ones", () => {
    const quests = [
        makeQuest({ id: "a", name: "A" }),
        makeQuest({ id: "b", name: "B", taskRequirements: [{ task: { id: "a", name: "A" }, status: ["Success"] }] }),
        makeQuest({ id: "c", name: "C", taskRequirements: [{ task: { id: "b", name: "B" }, status: ["Success"] }] }),
    ];
    const result = collectCompleteCascade("c", {
        questsById: buildQuestsById(quests),
        completedQuests: { a: true },
    });

    assert.deepEqual(result.toComplete.sort(), ["b", "c"]);
});

test("collectCompleteCascade flags cross-trader prereqs relative to the root", () => {
    const quests = [
        makeQuest({ id: "ther-root", name: "T", trader: therapist }),
        makeQuest({
            id: "prap-leaf",
            name: "P",
            taskRequirements: [{ task: { id: "ther-root", name: "T" }, status: ["Success"] }],
        }),
    ];
    const result = collectCompleteCascade("prap-leaf", {
        questsById: buildQuestsById(quests),
        completedQuests: {},
    });

    assert.deepEqual(result.toComplete.sort(), ["prap-leaf", "ther-root"]);
    assert.deepEqual(result.crossTraderQuestIds, ["ther-root"]);
});

test("collectCompleteCascade flags sensitive backfill quests in the chain", () => {
    const quests = [
        makeQuest({ id: NETWORK_PROVIDER_PART_1_ID, name: "Network Provider" }),
        makeQuest({
            id: "leaf",
            name: "Leaf",
            taskRequirements: [
                { task: { id: NETWORK_PROVIDER_PART_1_ID, name: "Network Provider" }, status: ["Success"] },
            ],
        }),
    ];
    const result = collectCompleteCascade("leaf", {
        questsById: buildQuestsById(quests),
        completedQuests: {},
    });

    assert.deepEqual(result.sensitiveQuestIds, [NETWORK_PROVIDER_PART_1_ID]);
});

test("collectCompleteCascade returns empty toComplete when root is already complete", () => {
    const quests = [makeQuest({ id: "root", name: "Root" })];
    const result = collectCompleteCascade("root", {
        questsById: buildQuestsById(quests),
        completedQuests: { root: true },
    });

    assert.deepEqual(result.toComplete, []);
});

test("collectCompleteCascade survives cycles", () => {
    const quests = [
        makeQuest({ id: "a", name: "A", taskRequirements: [{ task: { id: "b", name: "B" }, status: ["Success"] }] }),
        makeQuest({ id: "b", name: "B", taskRequirements: [{ task: { id: "a", name: "A" }, status: ["Success"] }] }),
    ];
    const result = collectCompleteCascade("a", {
        questsById: buildQuestsById(quests),
        completedQuests: {},
    });

    assert.deepEqual(result.toComplete.sort(), ["a", "b"]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
node --test --import jiti/register src/features/quests/quest-cascade.test.ts
```
Expected: FAIL — `Cannot find module './quest-cascade'`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/features/quests/quest-cascade.ts
import type { FullQuest } from "../../types/types";
import { getSensitiveBackfillQuest } from "../../lib/utils/sensitive-quest-backfill";

export interface QuestCascadeCompleteResult {
    toComplete: string[];
    crossTraderQuestIds: string[];
    sensitiveQuestIds: string[];
}

export interface CollectCompleteCascadeContext {
    questsById: ReadonlyMap<string, FullQuest>;
    completedQuests: Record<string, boolean>;
}

export function collectCompleteCascade(
    rootQuestId: string,
    ctx: CollectCompleteCascadeContext,
): QuestCascadeCompleteResult {
    const { questsById, completedQuests } = ctx;
    const rootQuest = questsById.get(rootQuestId);
    if (!rootQuest) {
        return { toComplete: [], crossTraderQuestIds: [], sensitiveQuestIds: [] };
    }

    const toComplete = new Set<string>();
    const visited = new Set<string>();
    const queue: string[] = [rootQuestId];

    while (queue.length > 0) {
        const questId = queue.pop()!;
        if (visited.has(questId)) continue;
        visited.add(questId);

        if (completedQuests[questId]) continue;

        const quest = questsById.get(questId);
        if (!quest) continue;

        toComplete.add(questId);
        for (const requirement of quest.taskRequirements) {
            queue.push(requirement.task.id);
        }
    }

    const rootTraderId = rootQuest.trader.id;
    const crossTraderQuestIds: string[] = [];
    const sensitiveQuestIds: string[] = [];

    for (const questId of toComplete) {
        const quest = questsById.get(questId);
        if (quest && quest.trader.id !== rootTraderId) {
            crossTraderQuestIds.push(questId);
        }
        if (getSensitiveBackfillQuest(questId)) {
            sensitiveQuestIds.push(questId);
        }
    }

    return {
        toComplete: Array.from(toComplete),
        crossTraderQuestIds,
        sensitiveQuestIds,
    };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
node --test --import jiti/register src/features/quests/quest-cascade.test.ts
```
Expected: PASS — 6 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/features/quests/quest-cascade.ts src/features/quests/quest-cascade.test.ts
git commit -m "feat: add collectCompleteCascade for quest checkbox cascade"
```

---

## Task 2: Add `collectUncompleteCascade` to `quest-cascade.ts`

**Files:**
- Modify: `src/features/quests/quest-cascade.ts`
- Modify: `src/features/quests/quest-cascade.test.ts`

The uncomplete cascade walks downstream — every quest that transitively *requires* the root — and only collects ones currently complete. Uses the pre-built `leadsToByQuestId` index that already exists in `QuestsContext`.

- [ ] **Step 1: Add failing tests**

Append to `src/features/quests/quest-cascade.test.ts`:

```typescript
import { collectUncompleteCascade } from "./quest-cascade";

function buildLeadsTo(quests: FullQuest[]) {
    const map = new Map<string, Set<string>>();
    for (const quest of quests) {
        for (const req of quest.taskRequirements) {
            const set = map.get(req.task.id) ?? new Set<string>();
            set.add(quest.id);
            map.set(req.task.id, set);
        }
    }
    return map;
}

test("collectUncompleteCascade returns just the root when nothing downstream is complete", () => {
    const quests = [
        makeQuest({ id: "root", name: "Root" }),
        makeQuest({ id: "leaf", name: "Leaf", taskRequirements: [{ task: { id: "root", name: "Root" }, status: ["Success"] }] }),
    ];
    const result = collectUncompleteCascade("root", {
        questsById: buildQuestsById(quests),
        completedQuests: { root: true },
        leadsToByQuestId: buildLeadsTo(quests),
    });

    assert.deepEqual(result.toUncomplete, ["root"]);
});

test("collectUncompleteCascade walks transitive completed dependents", () => {
    const quests = [
        makeQuest({ id: "root", name: "Root" }),
        makeQuest({ id: "mid", name: "Mid", taskRequirements: [{ task: { id: "root", name: "Root" }, status: ["Success"] }] }),
        makeQuest({ id: "leaf", name: "Leaf", taskRequirements: [{ task: { id: "mid", name: "Mid" }, status: ["Success"] }] }),
        makeQuest({ id: "leaf-incomplete", name: "Leaf 2", taskRequirements: [{ task: { id: "mid", name: "Mid" }, status: ["Success"] }] }),
    ];
    const result = collectUncompleteCascade("root", {
        questsById: buildQuestsById(quests),
        completedQuests: { root: true, mid: true, leaf: true },
        leadsToByQuestId: buildLeadsTo(quests),
    });

    assert.deepEqual(result.toUncomplete.sort(), ["leaf", "mid", "root"]);
});

test("collectUncompleteCascade flags cross-trader dependents", () => {
    const quests = [
        makeQuest({ id: "root", name: "Root" }),
        makeQuest({
            id: "ther-dep",
            name: "Therapist Dep",
            trader: therapist,
            taskRequirements: [{ task: { id: "root", name: "Root" }, status: ["Success"] }],
        }),
    ];
    const result = collectUncompleteCascade("root", {
        questsById: buildQuestsById(quests),
        completedQuests: { root: true, "ther-dep": true },
        leadsToByQuestId: buildLeadsTo(quests),
    });

    assert.deepEqual(result.toUncomplete.sort(), ["root", "ther-dep"]);
    assert.deepEqual(result.crossTraderQuestIds, ["ther-dep"]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
node --test --import jiti/register src/features/quests/quest-cascade.test.ts
```
Expected: FAIL — `collectUncompleteCascade is not exported`.

- [ ] **Step 3: Add the implementation**

Append to `src/features/quests/quest-cascade.ts`:

```typescript
export interface QuestCascadeUncompleteResult {
    toUncomplete: string[];
    crossTraderQuestIds: string[];
}

export interface CollectUncompleteCascadeContext {
    questsById: ReadonlyMap<string, FullQuest>;
    completedQuests: Record<string, boolean>;
    leadsToByQuestId: ReadonlyMap<string, ReadonlySet<string> | readonly string[]>;
}

export function collectUncompleteCascade(
    rootQuestId: string,
    ctx: CollectUncompleteCascadeContext,
): QuestCascadeUncompleteResult {
    const { questsById, completedQuests, leadsToByQuestId } = ctx;
    const rootQuest = questsById.get(rootQuestId);
    if (!rootQuest) {
        return { toUncomplete: [], crossTraderQuestIds: [] };
    }

    const toUncomplete = new Set<string>();
    const visited = new Set<string>();
    const queue: string[] = [rootQuestId];

    while (queue.length > 0) {
        const questId = queue.pop()!;
        if (visited.has(questId)) continue;
        visited.add(questId);

        if (!completedQuests[questId] && questId !== rootQuestId) continue;

        toUncomplete.add(questId);

        const dependents = leadsToByQuestId.get(questId);
        if (!dependents) continue;
        for (const dependentId of dependents) {
            queue.push(dependentId);
        }
    }

    const rootTraderId = rootQuest.trader.id;
    const crossTraderQuestIds: string[] = [];
    for (const questId of toUncomplete) {
        const quest = questsById.get(questId);
        if (quest && quest.trader.id !== rootTraderId) {
            crossTraderQuestIds.push(questId);
        }
    }

    return {
        toUncomplete: Array.from(toUncomplete),
        crossTraderQuestIds,
    };
}
```

Note: the root is always included in `toUncomplete` even if `completedQuests[root]` is false, because the caller invokes this on a checkbox click — if the root were complete we'd be in the complete-cascade branch instead. The check `if (!completedQuests[questId] && questId !== rootQuestId)` skips uncompleted dependents but never the root.

- [ ] **Step 4: Run the tests**

```bash
node --test --import jiti/register src/features/quests/quest-cascade.test.ts
```
Expected: PASS — 9 tests passing total.

- [ ] **Step 5: Commit**

```bash
git add src/features/quests/quest-cascade.ts src/features/quests/quest-cascade.test.ts
git commit -m "feat: add collectUncompleteCascade for quest checkbox cascade"
```

---

## Task 3: Add `applyQuestCompletionChange` to `useUserStore`

**Files:**
- Modify: `src/lib/stores/useUserStore.ts`

Single new action that does a bulk merge into `completedQuests`. Mirrors `toggleQuestCompletion` semantics: completing a quest also clears its `questsWithItems` flag.

- [ ] **Step 1: Find the existing `toggleQuestCompletion` action**

Read [src/lib/stores/useUserStore.ts:262-272](src/lib/stores/useUserStore.ts:262) — the new action goes immediately after it.

- [ ] **Step 2: Add the type to the store interface**

In the same file, find the `UserState` (or similar) interface containing `toggleQuestCompletion: (questId: string) => void;` and add directly below it:

```typescript
applyQuestCompletionChange: (changes: { complete?: string[]; uncomplete?: string[] }) => void;
```

- [ ] **Step 3: Add the implementation after `toggleQuestCompletion`**

Insert after the closing `}),` of `toggleQuestCompletion`:

```typescript
applyQuestCompletionChange: ({ complete = [], uncomplete = [] }) =>
    set((state) => {
        if (complete.length === 0 && uncomplete.length === 0) return {};

        const nextCompletedQuests = { ...state.completedQuests };
        for (const questId of complete) nextCompletedQuests[questId] = true;
        for (const questId of uncomplete) nextCompletedQuests[questId] = false;

        if (complete.length === 0) {
            return { completedQuests: nextCompletedQuests };
        }

        const nextQuestsWithItems = { ...state.questsWithItems };
        for (const questId of complete) nextQuestsWithItems[questId] = false;
        return { completedQuests: nextCompletedQuests, questsWithItems: nextQuestsWithItems };
    }),
```

- [ ] **Step 4: Verify it compiles**

```bash
npm run lint
```
Expected: No new errors in `useUserStore.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/useUserStore.ts
git commit -m "feat: add applyQuestCompletionChange bulk action to user store"
```

---

## Task 4: Add cascade request state to `useUIStore`

**Files:**
- Modify: `src/lib/stores/useUIStore.ts`

- [ ] **Step 1: Replace the file**

```typescript
import { create } from "zustand";
import type { ItemDetails } from "@/types";

export interface PendingItem {
    tempId: string;
    item: ItemDetails;
    nonFir: number;
    fir: number;
}

export interface QuestCascadeRequest {
    mode: "complete" | "uncomplete";
    rootQuestId: string;
    questIds: string[];
    crossTraderQuestIds: string[];
    sensitiveQuestIds: string[];
}

interface UIState {
    isQuickAddOpen: boolean;
    setQuickAddOpen: (isOpen: boolean) => void;
    pendingQuickAddItems: PendingItem[];
    setPendingQuickAddItems: (items: PendingItem[]) => void;
    clearPendingQuickAddItems: () => void;

    questCascadeRequest: QuestCascadeRequest | null;
    openQuestCascadeRequest: (request: QuestCascadeRequest) => void;
    closeQuestCascadeRequest: () => void;
}

export const useUIStore = create<UIState>((set) => ({
    isQuickAddOpen: false,
    setQuickAddOpen: (isOpen) => set({ isQuickAddOpen: isOpen }),
    pendingQuickAddItems: [],
    setPendingQuickAddItems: (items) => set({ pendingQuickAddItems: items }),
    clearPendingQuickAddItems: () => set({ pendingQuickAddItems: [] }),

    questCascadeRequest: null,
    openQuestCascadeRequest: (request) => set({ questCascadeRequest: request }),
    closeQuestCascadeRequest: () => set({ questCascadeRequest: null }),
}));
```

- [ ] **Step 2: Verify it compiles**

```bash
npm run lint
```
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/stores/useUIStore.ts
git commit -m "feat: add questCascadeRequest state to UI store"
```

---

## Task 5: Build `QuestListByTrader` reusable component

**Files:**
- Create: `src/features/quests/components/QuestListByTrader.tsx`

A pure, presentational component. Groups quests by trader, sorts traders by the existing `compareQuestTradersByOrder` util, optionally highlights a subset. No interactivity, no store reads.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useMemo } from "react";
import { compareQuestTradersByOrder } from "@/lib/cfg/questTraderOrder";
import type { FullQuest } from "@/types";

interface QuestListByTraderProps {
    questIds: string[];
    questsById: ReadonlyMap<string, FullQuest>;
    highlightQuestIds?: ReadonlySet<string>;
    emptyMessage?: string;
}

interface TraderGroup {
    trader: FullQuest["trader"];
    quests: FullQuest[];
}

export function QuestListByTrader({
    questIds,
    questsById,
    highlightQuestIds,
    emptyMessage = "No quests.",
}: QuestListByTraderProps) {
    const groups = useMemo<TraderGroup[]>(() => {
        const byTrader = new Map<string, TraderGroup>();
        const seen = new Set<string>();

        for (const questId of questIds) {
            if (seen.has(questId)) continue;
            seen.add(questId);
            const quest = questsById.get(questId);
            if (!quest) continue;

            const existing = byTrader.get(quest.trader.id);
            if (existing) {
                existing.quests.push(quest);
            } else {
                byTrader.set(quest.trader.id, { trader: quest.trader, quests: [quest] });
            }
        }

        for (const group of byTrader.values()) {
            group.quests.sort((a, b) => a.name.localeCompare(b.name));
        }

        return Array.from(byTrader.values()).sort((a, b) =>
            compareQuestTradersByOrder(a.trader.name, b.trader.name),
        );
    }, [questIds, questsById]);

    if (groups.length === 0) {
        return <div className="px-3 py-2 text-sm text-gray-500">{emptyMessage}</div>;
    }

    return (
        <div className="divide-y divide-white/5 rounded-sm border border-white/10 bg-black/20">
            {groups.map((group) => (
                <div key={group.trader.id} className="px-3 py-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                        {group.trader.imageLink && (
                            <img
                                src={group.trader.imageLink}
                                alt=""
                                className="h-5 w-5 rounded-full border border-white/10"
                            />
                        )}
                        <span>{group.trader.name}</span>
                        <span className="ml-auto text-[11px] tabular-nums text-gray-500">
                            {group.quests.length}
                        </span>
                    </div>
                    <ul className="mt-2 space-y-1">
                        {group.quests.map((quest) => {
                            const highlighted = highlightQuestIds?.has(quest.id) ?? false;
                            return (
                                <li
                                    key={quest.id}
                                    className={
                                        highlighted
                                            ? "rounded-sm border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-sm text-amber-100"
                                            : "px-2 py-1 text-sm text-gray-200"
                                    }
                                >
                                    {quest.name}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ))}
        </div>
    );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npm run lint
```
Expected: No errors in the new file.

- [ ] **Step 3: Commit**

```bash
git add src/features/quests/components/QuestListByTrader.tsx
git commit -m "feat: add reusable QuestListByTrader component"
```

---

## Task 6: Remove cross-trader inference from `quest-sync.ts`

**Files:**
- Modify: `src/features/quests/quest-sync.ts`
- Modify: `src/features/quests/quest-sync.test.ts`

Surgical removal. Keep `collectTransitivePrerequisiteIds` walking across traders for anchor prereqs (those writes are necessary, not speculative). Delete the cross-trader inference function and its call site. Remove the `inferOtherTraderChains` param.

- [ ] **Step 1: Update the failing tests first**

Edit [src/features/quests/quest-sync.test.ts](src/features/quests/quest-sync.test.ts):

Replace the test named `"syncTraderProgress backfills cross-trader prerequisites when they are the only inference blocker"` (lines 222-283) with this regression test for the reported bug:

```typescript
test("syncTraderProgress does NOT infer same-trader candidates blocked only by an incomplete cross-trader prereq (regression)", () => {
    const therapist = {
        id: "therapist",
        name: "Therapist",
        normalizedName: "therapist",
        imageLink: null,
        image4xLink: null,
    };

    const quests = [
        makeQuest({ id: "a", name: "A" }),
        makeQuest({
            id: "b",
            name: "B",
            taskRequirements: [{ task: { id: "a", name: "A" }, status: ["Success"] }],
        }),
        makeQuest({
            id: "selected",
            name: "Selected",
            taskRequirements: [{ task: { id: "b", name: "B" }, status: ["Success"] }],
        }),
        makeQuest({ id: "therapist-root", name: "Therapist Root", trader: therapist }),
        makeQuest({
            id: "therapist-bridge",
            name: "Therapist Bridge",
            trader: therapist,
            taskRequirements: [{ task: { id: "therapist-root", name: "Therapist Root" }, status: ["Success"] }],
        }),
        makeQuest({
            id: "dangling",
            name: "Dangling",
            taskRequirements: [
                { task: { id: "b", name: "B" }, status: ["Success"] },
                { task: { id: "therapist-bridge", name: "Therapist Bridge" }, status: ["Success"] },
            ],
        }),
    ];

    const result = syncTraderProgress({
        quests,
        traderId: "prapor",
        selectedQuestIds: ["selected"],
        profile: makeProfile(),
        questsWithItems: {},
    });

    assert.deepEqual(result.prerequisiteCompletedIds.sort(), ["a", "b"]);
    assert.deepEqual(result.inferredCompletedIds, []);
    assert.equal(result.nextCompletedQuests.dangling ?? false, false);
    assert.equal(result.nextCompletedQuests["therapist-bridge"] ?? false, false);
    assert.equal(result.nextCompletedQuests["therapist-root"] ?? false, false);
});
```

Then **delete** the test `"syncTraderProgress can skip same-trader inferred chains when disabled"` (lines 389-421) — `inferOtherTraderChains` no longer exists.

- [ ] **Step 2: Run the test suite to confirm new test fails and old behavior breaks**

```bash
node --test --import jiti/register src/features/quests/quest-sync.test.ts
```
Expected: FAIL — the regression test fails because the current code speculatively backfills.

- [ ] **Step 3: Update `quest-sync.ts`**

In [src/features/quests/quest-sync.ts](src/features/quests/quest-sync.ts):

1. Delete the entire function `getCrossTraderBackfillIdsThatMakeQuestAvailable` (lines 96-161).
2. Delete `inferOtherTraderChains?: boolean;` from `SyncTraderProgressInput`.
3. Delete the `inferOtherTraderChains = true,` destructuring default in `syncTraderProgress`.
4. In the inference loop, simplify the candidate test. Replace this block (currently lines 233-289):

```typescript
    if (inferOtherTraderChains) {
        let madeProgress = true;
        while (madeProgress) {
            madeProgress = false;

            for (const quest of activeTraderQuests) {
                if (selectedQuestIdSet.has(quest.id)) continue;
                if (nextCompletedQuests[quest.id]) continue;
                if (!quest.taskRequirements.some((requirement) => completedAnchorIds.has(requirement.task.id))) continue;

                const isAvailable = isQuestAvailableForProfile(
                    quest,
                    syncProfile,
                    questAvailabilityById,
                );
                const crossTraderBackfill = isAvailable
                    ? { questIds: null, blockedSensitiveQuestIds: new Set<string>() }
                    : getCrossTraderBackfillIdsThatMakeQuestAvailable({ /* ... */ });

                if (crossTraderBackfill.blockedSensitiveQuestIds.size > 0) {
                    for (const questId of crossTraderBackfill.blockedSensitiveQuestIds) {
                        blockedSensitiveQuestIds.add(questId);
                    }
                    continue;
                }
                if (!isAvailable && !crossTraderBackfill.questIds) continue;

                if (getSensitiveBackfillQuest(quest.id) && !allowedSensitiveQuestIds.has(quest.id)) {
                    if (deniedSensitiveQuestIds.has(quest.id)) {
                        recordCompletion(quest.id, inferredCompletedIds);
                        continue;
                    }

                    blockedSensitiveQuestIds.add(quest.id);
                    continue;
                }

                if (crossTraderBackfill.questIds) {
                    for (const questId of crossTraderBackfill.questIds) {
                        completedAnchorIds.add(questId);
                        madeProgress = recordCompletion(questId, inferredCompletedIds) || madeProgress;
                    }
                }

                completedAnchorIds.add(quest.id);
                madeProgress = recordCompletion(quest.id, inferredCompletedIds) || madeProgress;
            }
        }
    }
```

with:

```typescript
    let madeProgress = true;
    while (madeProgress) {
        madeProgress = false;

        for (const quest of activeTraderQuests) {
            if (selectedQuestIdSet.has(quest.id)) continue;
            if (nextCompletedQuests[quest.id]) continue;
            if (!quest.taskRequirements.some((requirement) => completedAnchorIds.has(requirement.task.id))) continue;
            if (!isQuestAvailableForProfile(quest, syncProfile, questAvailabilityById)) continue;

            if (getSensitiveBackfillQuest(quest.id) && !allowedSensitiveQuestIds.has(quest.id)) {
                if (deniedSensitiveQuestIds.has(quest.id)) {
                    recordCompletion(quest.id, inferredCompletedIds);
                    continue;
                }

                blockedSensitiveQuestIds.add(quest.id);
                continue;
            }

            completedAnchorIds.add(quest.id);
            madeProgress = recordCompletion(quest.id, inferredCompletedIds) || madeProgress;
        }
    }
```

Note: `allowedSensitiveQuestIds` and `deniedSensitiveQuestIds` are still used for the anchor-prereq walk via `collectTransitivePrerequisiteIds` and for sensitive same-trader inferred quests — keep those declarations.

- [ ] **Step 4: Update `QuestsContext.tsx` to drop the `inferOtherTraderChains` parameter**

In [src/features/quests/QuestsContext.tsx](src/features/quests/QuestsContext.tsx):

In the `QuestsContextValue` interface (lines 74-87), change the signatures to:

```typescript
    previewTraderSelection: (
        traderId: string,
        selectedQuestIds: string[],
        allowedSensitiveBackfillQuestIds?: string[],
        deniedSensitiveBackfillQuestIds?: string[],
    ) => QuestSyncResult;
    syncTraderSelection: (
        traderId: string,
        selectedQuestIds: string[],
        allowedSensitiveBackfillQuestIds?: string[],
        deniedSensitiveBackfillQuestIds?: string[],
    ) => LastQuestSyncAction;
```

In the implementations (lines 366-416), remove the `inferOtherTraderChains: boolean,` param from both functions, remove `inferOtherTraderChains` from the `syncTraderProgress` call args, and remove it from the recursive `previewTraderSelection` call inside `syncTraderSelection`.

- [ ] **Step 5: Update any callers in `QuestSyncTraderStep.tsx`**

In `src/features/quests/components/QuestSyncTraderStep.tsx`, find any callers of `previewTraderSelection` / `syncTraderSelection` that pass an `inferOtherTraderChains` boolean (positional 3rd arg before any sensitive arrays) and remove that argument. If there is a UI toggle for "infer other trader chains," delete that toggle and any associated state.

- [ ] **Step 6: Run tests and lint**

```bash
node --test --import jiti/register src/features/quests/quest-sync.test.ts
npm run lint
```
Expected: All `quest-sync.test.ts` tests pass. Lint clean.

- [ ] **Step 7: Run full build**

```bash
npm run build
```
Expected: Build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/features/quests/quest-sync.ts src/features/quests/quest-sync.test.ts src/features/quests/QuestsContext.tsx src/features/quests/components/QuestSyncTraderStep.tsx
git commit -m "fix: remove speculative cross-trader inference from manual quest sync"
```

---

## Task 7: Add `requestToggleQuestCompletion` to `QuestsContext`

**Files:**
- Modify: `src/features/quests/QuestsContext.tsx`

This computes the cascade and either dispatches to the store directly or opens the dialog via `useUIStore`. Triggers per the spec:
- Complete dialog opens when: `crossTraderQuestIds.length > 0` OR `toComplete.length > 10` OR `sensitiveQuestIds.length > 0`.
- Uncomplete dialog opens when: `toUncomplete.length > 1` (any downstream complete).

- [ ] **Step 1: Add imports**

At the top of [src/features/quests/QuestsContext.tsx](src/features/quests/QuestsContext.tsx), add:

```typescript
import { useUIStore } from "@/lib/stores/useUIStore";
import { collectCompleteCascade, collectUncompleteCascade } from "./quest-cascade";
```

- [ ] **Step 2: Convert `leadsToByQuestId` value type**

The cascade uses `ReadonlySet<string> | readonly string[]` and the existing `leadsToByQuestId` returns `Map<string, string[]>` — that already satisfies the readonly array variant, no change needed.

- [ ] **Step 3: Add the method to the context interface**

In the `QuestsContextValue` interface, add:

```typescript
    requestToggleQuestCompletion: (questId: string) => void;
```

- [ ] **Step 4: Implement the method inside `QuestsProvider`**

Inside `QuestsProvider`, after `getSyncCandidatesForTrader` is defined and before the return, add:

```typescript
    const requestToggleQuestCompletion = (questId: string) => {
        const userState = useUserStore.getState();
        const isCurrentlyComplete = !!userState.completedQuests[questId];

        if (isCurrentlyComplete) {
            const cascade = collectUncompleteCascade(questId, {
                questsById,
                completedQuests: userState.completedQuests,
                leadsToByQuestId,
            });

            if (cascade.toUncomplete.length <= 1) {
                userState.applyQuestCompletionChange({ uncomplete: cascade.toUncomplete });
                return;
            }

            useUIStore.getState().openQuestCascadeRequest({
                mode: "uncomplete",
                rootQuestId: questId,
                questIds: cascade.toUncomplete,
                crossTraderQuestIds: cascade.crossTraderQuestIds,
                sensitiveQuestIds: [],
            });
            return;
        }

        const cascade = collectCompleteCascade(questId, {
            questsById,
            completedQuests: userState.completedQuests,
        });

        if (cascade.toComplete.length === 0) return;

        const shouldConfirm =
            cascade.crossTraderQuestIds.length > 0 ||
            cascade.toComplete.length > 10 ||
            cascade.sensitiveQuestIds.length > 0;

        if (!shouldConfirm) {
            userState.applyQuestCompletionChange({ complete: cascade.toComplete });
            return;
        }

        useUIStore.getState().openQuestCascadeRequest({
            mode: "complete",
            rootQuestId: questId,
            questIds: cascade.toComplete,
            crossTraderQuestIds: cascade.crossTraderQuestIds,
            sensitiveQuestIds: cascade.sensitiveQuestIds,
        });
    };
```

- [ ] **Step 5: Expose it in the provider value**

In the JSX `value={{ ... }}` object, add `requestToggleQuestCompletion,` near the other action callbacks.

- [ ] **Step 6: Verify it compiles**

```bash
npm run lint
```
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/features/quests/QuestsContext.tsx
git commit -m "feat: add requestToggleQuestCompletion to QuestsContext"
```

---

## Task 8: Route `QuestCard` checkbox through the new context method

**Files:**
- Modify: `src/features/quests/QuestCard.tsx`

- [ ] **Step 1: Switch the store action for the context method**

In [src/features/quests/QuestCard.tsx](src/features/quests/QuestCard.tsx), find the destructuring around line 261-269:

```typescript
        toggleQuestCompletion,
```

and the matching selector:

```typescript
            toggleQuestCompletion: state.toggleQuestCompletion,
```

Remove both. Add at the top of the component (after other `useQuestsContext` hooks):

```typescript
    const { requestToggleQuestCompletion } = useQuestsContext();
```

(If `useQuestsContext` is already being called in this component, just add `requestToggleQuestCompletion` to the destructuring.)

- [ ] **Step 2: Update the click handler**

Find line ~418:

```typescript
                        toggleQuestCompletion(quest.id);
```

Replace with:

```typescript
                        requestToggleQuestCompletion(quest.id);
```

- [ ] **Step 3: Verify it compiles**

```bash
npm run lint
```
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/quests/QuestCard.tsx
git commit -m "feat: route QuestCard completion checkbox through cascade"
```

---

## Task 9: Build `QuestCascadeConfirmDialog`

**Files:**
- Create: `src/features/quests/components/QuestCascadeConfirmDialog.tsx`

- [ ] **Step 1: Write the dialog**

```tsx
"use client";

import { useMemo } from "react";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useUIStore } from "@/lib/stores/useUIStore";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import type { FullQuest } from "@/types";
import { getSensitiveBackfillQuest } from "@/lib/utils/sensitive-quest-backfill";
import { QuestListByTrader } from "./QuestListByTrader";

interface QuestCascadeConfirmDialogProps {
    quests: FullQuest[];
}

export function QuestCascadeConfirmDialog({ quests }: QuestCascadeConfirmDialogProps) {
    const request = useUIStore((state) => state.questCascadeRequest);
    const closeRequest = useUIStore((state) => state.closeQuestCascadeRequest);
    const applyQuestCompletionChange = useUserStore((state) => state.applyQuestCompletionChange);
    const questsById = useMemo(
        () => new Map(quests.map((quest) => [quest.id, quest])),
        [quests],
    );

    if (!request) return null;

    const isComplete = request.mode === "complete";
    const totalCount = request.questIds.length;
    const crossTraderCount = request.crossTraderQuestIds.length;
    const sensitiveCount = request.sensitiveQuestIds.length;

    const highlightQuestIds = new Set<string>([
        ...request.crossTraderQuestIds,
        ...request.sensitiveQuestIds,
    ]);

    const handleConfirm = () => {
        if (isComplete) {
            applyQuestCompletionChange({ complete: request.questIds });
        } else {
            applyQuestCompletionChange({ uncomplete: request.questIds });
        }
        closeRequest();
    };

    return (
        <Dialog open={true} onOpenChange={(open) => { if (!open) closeRequest(); }}>
            <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden border-border-color bg-card p-0 md:max-w-2xl">
                <DialogHeader className="border-b border-border-color bg-black/60 px-6 py-4">
                    <DialogTitle className="text-sm font-semibold tracking-[0.2em] text-gray-300">
                        {isComplete
                            ? `Mark ${totalCount} quest${totalCount === 1 ? "" : "s"} as complete`
                            : `Uncomplete ${totalCount} quest${totalCount === 1 ? "" : "s"}`}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-gray-400">
                        {isComplete
                            ? "Completing this quest will also complete the prerequisite chain below."
                            : "Uncompleting this quest will also uncomplete the quests that depend on it."}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-3 px-6 py-4">
                    {crossTraderCount > 0 && (
                        <div className="rounded-sm border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                            Includes {crossTraderCount} quest{crossTraderCount === 1 ? "" : "s"} from other traders.
                        </div>
                    )}
                    {sensitiveCount > 0 && (
                        <div className="rounded-sm border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-100">
                            Includes sensitive backfill:{" "}
                            {request.sensitiveQuestIds
                                .map((id) => questsById.get(id)?.name ?? getSensitiveBackfillQuest(id)?.name ?? id)
                                .join(", ")}
                            . Confirm only if you have actually done these.
                        </div>
                    )}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
                    <QuestListByTrader
                        questIds={request.questIds}
                        questsById={questsById}
                        highlightQuestIds={highlightQuestIds}
                    />
                </div>

                <div className="flex justify-end gap-2 border-t border-border-color bg-black/40 px-6 py-3">
                    <button
                        type="button"
                        onClick={closeRequest}
                        className="rounded-sm border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-300 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        className="rounded-sm border border-tarkov-green/30 bg-tarkov-green/10 px-3 py-2 text-sm font-semibold text-tarkov-green transition-colors hover:border-tarkov-green/60"
                    >
                        Confirm
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
```

- [ ] **Step 2: Mount the dialog inside `QuestsClientPage`**

In [src/features/quests/QuestsClientPage.tsx](src/features/quests/QuestsClientPage.tsx), add the import:

```typescript
import { QuestCascadeConfirmDialog } from "./components/QuestCascadeConfirmDialog";
```

Then, inside the `QuestsProvider` JSX tree (so it shares the same quest data), render `<QuestCascadeConfirmDialog quests={quests} />` once. Place it adjacent to the existing modal mounts.

- [ ] **Step 3: Verify it compiles and runs**

```bash
npm run lint
npm run build
```
Expected: Clean.

- [ ] **Step 4: Commit**

```bash
git add src/features/quests/components/QuestCascadeConfirmDialog.tsx src/features/quests/QuestsClientPage.tsx
git commit -m "feat: add QuestCascadeConfirmDialog for checkbox cascade"
```

---

## Task 10: Migrate `QuestSyncTraderStep` result list to `QuestListByTrader`

**Files:**
- Modify: `src/features/quests/components/QuestSyncTraderStep.tsx`

Find the rendering that lists completed quest ids (typically a `<ul>` mapped from `result.completedIds` or similar) and replace it with `<QuestListByTrader questIds={...} questsById={...} />`. The `questsById` map is available via `useQuestsContext`.

- [ ] **Step 1: Add the import**

```typescript
import { QuestListByTrader } from "./QuestListByTrader";
```

- [ ] **Step 2: Replace each completed-id list rendering**

For each location showing a flat list of completed quest names/ids from a sync result (preview or post-sync), replace with:

```tsx
<QuestListByTrader questIds={completedIds} questsById={questsById} emptyMessage="No quests will change." />
```

- [ ] **Step 3: Verify it compiles and the dialog still renders**

```bash
npm run lint
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/features/quests/components/QuestSyncTraderStep.tsx
git commit -m "refactor: use QuestListByTrader in manual sync result view"
```

---

## Task 11: Migrate `QuestLogImportDialog` review lists to `QuestListByTrader`

**Files:**
- Modify: `src/features/quests/components/QuestLogImportDialog.tsx`

The review step renders two `ReviewList` instances at [src/features/quests/components/QuestLogImportDialog.tsx:953-980](src/features/quests/components/QuestLogImportDialog.tsx:953): "Quests from Logs" and "Prerequisites to Auto-Complete". Both should use `QuestListByTrader`.

- [ ] **Step 1: Add the import**

```typescript
import { QuestListByTrader } from "./QuestListByTrader";
```

- [ ] **Step 2: Replace the two `ReviewList` instances in `ReviewStep`**

Replace:

```tsx
                <ReviewList
                    title="Quests from Logs"
                    emptyState={`No ${mode} quests are queued for import.`}
                    items={importedRows.map((row) => ({ /* ... */ }))}
                />

                {prerequisiteQuests.length > 0 && (
                    <ReviewList
                        title="Prerequisites to Auto-Complete"
                        emptyState="No prerequisite quests will be auto-completed."
                        items={prerequisiteQuests.map((quest) => ({ /* ... */ }))}
                    />
                )}
```

with:

```tsx
                <section className="rounded-lg border border-white/10 bg-black/20">
                    <div className="border-b border-white/10 px-4 py-3">
                        <h3 className="text-sm font-semibold text-white">Quests from Logs</h3>
                    </div>
                    <div className="p-3">
                        <QuestListByTrader
                            questIds={importedRows.map((row) => row.questId)}
                            questsById={questsById}
                            emptyMessage={`No ${mode} quests are queued for import.`}
                        />
                    </div>
                </section>

                {prerequisiteQuests.length > 0 && (
                    <section className="rounded-lg border border-white/10 bg-black/20">
                        <div className="border-b border-white/10 px-4 py-3">
                            <h3 className="text-sm font-semibold text-white">Prerequisites to Auto-Complete</h3>
                        </div>
                        <div className="p-3">
                            <QuestListByTrader
                                questIds={prerequisiteQuests.map((quest) => quest.id)}
                                questsById={questsById}
                            />
                        </div>
                    </section>
                )}
```

`questsById` is already computed at the top of `QuestLogImportDialog` (line ~100). Pass it through to `ReviewStep` as a new prop — add `questsById: ReadonlyMap<string, FullQuest>` to the `ReviewStep` props interface and pass it when calling `<ReviewStep ... questsById={questsById} />`.

- [ ] **Step 3: Delete the now-unused `ReviewList` helper if nothing else calls it**

After the migration, search the file for remaining `<ReviewList` usages. If none remain, delete the `function ReviewList(...) { ... }` definition.

- [ ] **Step 4: Verify it compiles and the dialog still renders**

```bash
npm run lint
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/features/quests/components/QuestLogImportDialog.tsx
git commit -m "refactor: use QuestListByTrader in quest log import review"
```

---

## Task 12: Manual verification

**Files:** none (dev-server testing)

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify the manual-sync regression is fixed**

Reproduce the original bug: open the manual sync dialog, run the user's prior selection that produced the false-positive third-in-chain quest. Confirm the chain stops where the cross-trader prereq is incomplete and the false-positive quest is not marked complete.

- [ ] **Step 3: Verify checkbox cascade — silent path**

Find an incomplete quest whose only missing prereq is a same-trader prereq (≤10 total missing). Click the checkbox. No dialog should appear. Both quests become complete.

- [ ] **Step 4: Verify checkbox cascade — confirm path (cross-trader)**

Find an incomplete quest with at least one missing cross-trader prereq. Click the checkbox. Dialog opens, shows the full list grouped by trader, highlights the cross-trader entries, shows the "Includes N quests from other traders" banner. Confirm — both quests become complete. Try again with Cancel — nothing changes.

- [ ] **Step 5: Verify checkbox cascade — confirm path (>10)**

Find an incomplete quest with a deep prereq chain (>10 missing prereqs). Click the checkbox. Dialog opens. Confirm — all marked complete.

- [ ] **Step 6: Verify sensitive backfill gate**

If "Network Provider — Part 1" is reachable as a prereq in the cascade for any quest, click that downstream quest. Dialog opens with red sensitive banner.

- [ ] **Step 7: Verify uncomplete cascade**

Find a complete quest with no completed dependents. Uncheck — no dialog, just the root uncompletes.

Then find a complete quest with at least one completed downstream quest. Uncheck — dialog opens listing all downstream quests by trader. Confirm and verify all uncomplete. Try Cancel — nothing changes.

- [ ] **Step 8: Verify the two sync dialogs still render**

Open the manual sync dialog and the quest log import dialog. Confirm the trader-grouped quest lists render correctly in both.

- [ ] **Step 9: Final lint + build**

```bash
npm run lint
npm run build
```
Expected: Clean.

---

## Self-Review Notes

- Spec coverage: every section A–F of the design has at least one task. ✓
- `applyQuestCompletionChange` is defined in Task 3 and consumed in Task 7, Task 9 — names match.
- `QuestListByTrader` is built in Task 5 and consumed in Tasks 9, 10, 11 — name matches.
- `requestToggleQuestCompletion` defined Task 7, consumed Task 8 — name matches.
- `questCascadeRequest` / `openQuestCascadeRequest` / `closeQuestCascadeRequest` defined Task 4, consumed Task 7 and Task 9 — names match.
- `inferOtherTraderChains` deletion is internally consistent: removed from `quest-sync.ts`, `quest-sync.test.ts`, `QuestsContext.tsx`, and `QuestSyncTraderStep.tsx`.
- Anchor-prereq backfill (the safe, necessary kind) is explicitly preserved — Task 6 keeps `collectTransitivePrerequisiteIds` and the sensitive-backfill UI in the trader step.
