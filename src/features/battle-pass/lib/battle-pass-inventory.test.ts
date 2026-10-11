import assert from "node:assert/strict";
import test from "node:test";
import { useUserStore } from "../../../lib/stores/useUserStore";
import {
	commitInventoryUpdate,
	completeInventoryTiles,
	documentItemIds,
	inventoryProgress,
	prepareInventoryUpdate,
	type PlayerItemCounts,
} from "./battle-pass-inventory";
import { emptyProgress, type Tile } from "./battle-pass-model";

const financialId = documentItemIds.financial;
const rewards: Tile[] = [
	{
		id: "a",
		slot: 1,
		displayName: "a",
		img: "",
		bigImg: "",
		cost: { financial: 4, project: 2 },
		totalDocumentCost: 6,
		rewards: [],
	},
	{
		id: "b",
		slot: 2,
		displayName: "b",
		img: "",
		bigImg: "",
		cost: { financial: 3 },
		totalDocumentCost: 3,
		rewards: [],
	},
];

test("live profile inventory overrides legacy only when the record exists and counts both buckets", () => {
	const stored = { ...emptyProgress(), inventory: { financial: 20, project: 7, unknown: 9 } };
	const counts = { [financialId]: { have: 2, haveFir: 3 } };
	assert.deepEqual(inventoryProgress(stored, counts).inventory, { financial: 5, project: 7, unknown: 9 });
	assert.equal(inventoryProgress(stored, { [financialId]: { have: 0, haveFir: 0 } }).inventory.financial, 0);
	assert.equal(inventoryProgress(stored, { [financialId]: { have: -5, haveFir: 3 } }).inventory.financial, 3);
	assert.equal(stored.inventory.financial, 20);
});

test("live inventory edits preserve FIR stock and legacy data without storing a duplicate", () => {
	const stored = { ...emptyProgress(), inventory: { financial: 20, unknown: 9 }, completed: ["unknown-done"] };
	const counts = { [financialId]: { have: 2, haveFir: 3 } };
	const live = inventoryProgress(stored, counts);
	const prepared = prepareInventoryUpdate(
		stored,
		{ ...live, inventory: { ...live.inventory, financial: 4, project: 7 } },
		counts,
	);
	assert.deepEqual(prepared.changes, [{ itemId: financialId, haveDelta: -1, haveFirDelta: 0 }]);
	assert.deepEqual(prepared.progress.inventory, { financial: 20, project: 7, unknown: 9 });
	assert.deepEqual(prepared.progress.completed, ["unknown-done"]);
	assert.deepEqual(prepareInventoryUpdate(stored, { ...live, goals: ["a"] }, counts).changes, []);
	assert.deepEqual(prepareInventoryUpdate(stored, { ...live, inventory: { financial: 1 } }, counts).changes, [
		{ itemId: financialId, haveDelta: -2, haveFirDelta: -2 },
	]);
	assert.deepEqual(prepareInventoryUpdate(stored, { ...live, inventory: { financial: 8 } }, counts).changes, [
		{ itemId: financialId, haveDelta: 3, haveFirDelta: 0 },
	]);
	assert.deepEqual(
		prepareInventoryUpdate(emptyProgress(), { ...emptyProgress(), inventory: { financial: 8 } }, counts).progress
			.inventory,
		{},
	);
});

test("completion off adds only known rewards, without touching inventory or classified", () => {
	const stored = { ...emptyProgress(), completed: ["unknown-done"], inventory: { project: 7 }, classified: 50 };
	const result = completeInventoryTiles(
		stored,
		{ [financialId]: { have: 2, haveFir: 3 } },
		["a", "a", "missing"],
		false,
		rewards,
	);
	assert.deepEqual(result.changes, []);
	assert.deepEqual(result.progress, { ...stored, completed: ["unknown-done", "a"] });
});

test("completion spends new reward costs once, ordinary stock first, with partial stock clamped", () => {
	const stored = {
		...emptyProgress(),
		completed: ["b", "unknown-done"],
		inventory: { project: 1, financial: 99, unknown: 9 },
		classified: 50,
	};
	const counts = { [financialId]: { have: 2, haveFir: 3 } };
	const result = completeInventoryTiles(stored, counts, ["a", "a", "b", "missing"], true, rewards);
	assert.deepEqual(result.changes, [{ itemId: financialId, haveDelta: -2, haveFirDelta: -2 }]);
	assert.deepEqual(result.progress.inventory, { project: 0, financial: 99, unknown: 9 });
	assert.equal(result.progress.classified, 50);
	assert.deepEqual(result.progress.completed, ["b", "unknown-done", "a"]);
	assert.deepEqual(completeInventoryTiles(result.progress, counts, ["a", "b"], true, rewards).changes, []);
	assert.deepEqual(completeInventoryTiles(emptyProgress(), counts, ["a", "b"], true, rewards).changes, [
		{ itemId: financialId, haveDelta: -2, haveFirDelta: -3 },
	]);
	assert.deepEqual(
		completeInventoryTiles(emptyProgress(), { [financialId]: { have: -1, haveFir: 2 } }, ["a"], true, rewards).changes,
		[{ itemId: financialId, haveDelta: 0, haveFirDelta: -2 }],
	);
});

test("consumption via existing actions affects only the active profile and leaves other item counts intact", () => {
	const initial = useUserStore.getState();
	try {
		useUserStore.getState().resetAll();
		useUserStore.getState().addItemCounts(financialId, 2, 3);
		useUserStore.getState().addItemCounts("unrelated", 5, 1);
		useUserStore.getState().setGameMode("PVE");
		useUserStore.getState().addItemCounts(financialId, 8, 1);
		useUserStore.getState().setGameMode("PVP");
		const state = useUserStore.getState();
		const prepared = completeInventoryTiles(
			emptyProgress(),
			state.itemCounts as PlayerItemCounts,
			["a"],
			true,
			rewards,
		);
		for (const change of prepared.changes) state.addItemCounts(change.itemId, change.haveDelta, change.haveFirDelta);
		assert.deepEqual(useUserStore.getState().itemCounts[financialId], { have: 0, haveFir: 1 });
		assert.deepEqual(useUserStore.getState().itemCounts.unrelated, { have: 5, haveFir: 1 });
		useUserStore.getState().setGameMode("PVE");
		assert.deepEqual(useUserStore.getState().itemCounts[financialId], { have: 8, haveFir: 1 });
		assert.equal(inventoryProgress(emptyProgress(), useUserStore.getState().itemCounts).inventory.financial, 9);
		useUserStore.getState().setGameMode("KORD");
		assert.deepEqual(useUserStore.getState().itemCounts, {});
	} finally {
		useUserStore.setState(initial, true);
	}
});

test("profile effects run once after saving even if a writer evaluates the pure transform twice", () => {
	const counts = { [financialId]: { have: 2, haveFir: 3 } };
	const effects: unknown[] = [];
	let saved: string | null = null;
	let writing = false;
	const write = (transform: (raw: string | null) => string) => {
		writing = true;
		transform(saved);
		assert.deepEqual(effects, []);
		saved = transform(saved);
		assert.deepEqual(effects, []);
		writing = false;
	};
	const complete = (stored: ReturnType<typeof emptyProgress>, snapshot: PlayerItemCounts) =>
		completeInventoryTiles(stored, snapshot, ["a", "a"], true, rewards);
	const apply = (itemId: string, have: number, fir: number) => {
		assert.equal(writing, false);
		effects.push([itemId, have, fir]);
	};
	commitInventoryUpdate(write, counts, complete, apply);
	assert.deepEqual(effects, [[financialId, -2, -2]]);
	effects.length = 0;
	commitInventoryUpdate(write, counts, complete, apply);
	assert.deepEqual(effects, []);
});
