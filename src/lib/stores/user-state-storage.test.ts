import "../../features/settings/progress-backup-test-storage";
import assert from "node:assert/strict";
import test from "node:test";
import { createJSONStorage } from "zustand/middleware";
import { useUserStore } from "./useUserStore";
import { createUserStateStorage, LEGACY_USER_STORE_STORAGE_KEY, USER_STORE_STORAGE_KEY } from "./user-state-storage";

// main's v15 persisted shape: separate non-FiR/FiR balances, stable IDs,
// setup markers and quest progress. No profile map or conversion flags.
const oldState = {
	stationLevels: { "station-a": 3, "station-b": 2 },
	completedRequirements: { "requirement-a": true },
	itemCounts: { "item-a": { have: 7, haveFir: 4 }, "item-b": { have: -2, haveFir: 1 } },
	completedQuests: { "quest-a": true },
	failedQuests: { "quest-b": true },
	questsWithItems: { "quest-c": true },
	pinnedQuests: { "quest-d": true },
	questChangeHistory: [{ questId: "quest-a", timestamp: 123, change: "completed" }],
	playerLevel: 35,
	gameEdition: "Unheard",
	editionBonusesAppliedFor: "Unheard",
	hasCompletedSetup: true,
	gameMode: "PVE",
};

function setup(state: unknown = oldState, version = 15) {
	const values = new Map<string, string>();
	let fail = false;
	const storage: Storage = {
		get length() {
			return values.size;
		},
		key: (index) => [...values.keys()][index] ?? null,
		clear: () => values.clear(),
		getItem: (key) => values.get(key) ?? null,
		setItem: (key, value) => {
			if (fail) throw new Error("Quota exceeded");
			values.set(key, value);
		},
		removeItem: (key) => {
			values.delete(key);
		},
	};
	useUserStore.persist.setOptions({ storage: createJSONStorage(() => createUserStateStorage(storage)) });
	useUserStore.setState(useUserStore.getInitialState(), true);
	values.clear();
	const original = JSON.stringify({ state, version });
	values.set(LEGACY_USER_STORE_STORAGE_KEY, original);
	return {
		values,
		storage,
		original,
		failWrites: () => {
			fail = true;
		},
	};
}

test("v15 hydration offers conversion, preserves original bytes, and imports progression without quests", async () => {
	const { storage, original } = setup();
	await useUserStore.persist.rehydrate();
	assert.equal(useUserStore.persist.hasHydrated(), true);
	const pending = useUserStore.getState();
	assert.deepEqual(pending.deprecatedLegacyState, oldState);
	assert.equal(pending.hasConvertedDeprecatedLegacyState, false);
	assert.equal(pending.hasDismissedDeprecatedLegacyState, false);
	assert.deepEqual(pending.itemCounts, {});
	useUserStore.getState().setPlayerLevel(9);
	useUserStore.getState().convertDeprecatedLegacyState("PVE");
	await useUserStore.persist.rehydrate();
	const converted = useUserStore.getState();
	assert.equal(converted.hasCompletedSetup, true);
	assert.equal(converted.editionBonusesAppliedFor, "Unheard");
	assert.equal(converted.gameMode, "PVE");
	assert.equal(converted.hasConvertedDeprecatedLegacyState, true);
	assert.deepEqual(converted.stationLevels, oldState.stationLevels);
	assert.deepEqual(converted.completedRequirements, oldState.completedRequirements);
	assert.deepEqual(converted.itemCounts, oldState.itemCounts);
	for (const key of [
		"completedQuests",
		"completedQuestObjectives",
		"failedQuests",
		"questsWithItems",
		"pinnedQuests",
	] as const) {
		assert.deepEqual(converted[key], {});
	}
	assert.deepEqual(converted.questChangeHistory, []);
	assert.equal(converted.profiles.PVP.playerLevel, 9);
	useUserStore.getState().setGameMode("PVP");
	useUserStore.getState().setGameMode("PVE");
	assert.deepEqual(useUserStore.getState().itemCounts, oldState.itemCounts);
	assert.equal(storage.getItem(LEGACY_USER_STORE_STORAGE_KEY), original);
});

test("flat saves with stale conversion flags or a newer version still offer conversion", async () => {
	for (const version of [15, 19, 23]) {
		setup({ ...oldState, hasConvertedDeprecatedLegacyState: true, hasDismissedDeprecatedLegacyState: true }, version);
		await useUserStore.persist.rehydrate();
		assert.equal(useUserStore.getState().hasConvertedDeprecatedLegacyState, false);
		assert.equal(useUserStore.getState().hasDismissedDeprecatedLegacyState, false);
		assert.deepEqual(useUserStore.getState().deprecatedLegacyState?.itemCounts, oldState.itemCounts);
	}
});

test("existing v23 profiles and their quest progress survive relocation", async () => {
	setup();
	useUserStore.getState().setGameMode("KORD");
	useUserStore.getState().setPlayerLevel(42);
	useUserStore.getState().toggleQuestCompletion("new-quest");
	useUserStore.getState().setHideMoney(true);
	const saved = JSON.parse(JSON.stringify(useUserStore.getState()));
	const { storage, original } = setup(saved, 23);
	await useUserStore.persist.rehydrate();
	assert.equal(useUserStore.getState().playerLevel, 42);
	assert.equal(useUserStore.getState().completedQuests["new-quest"], true);
	assert.equal(useUserStore.getState().hideMoney, true);
	useUserStore.getState().setPlayerLevel(43);
	assert.equal(storage.getItem(LEGACY_USER_STORE_STORAGE_KEY), original);
	assert.equal(JSON.parse(storage.getItem(USER_STORE_STORAGE_KEY)!).state.playerLevel, 43);
});

test("an old build's retained profile map does not discard new progress or hide its new flat progress", async () => {
	const profiles = useUserStore.getInitialState().profiles;
	setup({ ...oldState, profiles, hasConvertedDeprecatedLegacyState: true });
	await useUserStore.persist.rehydrate();
	assert.deepEqual(useUserStore.getState().profiles.PVP.itemCounts, {});
	assert.deepEqual(useUserStore.getState().deprecatedLegacyState?.itemCounts, oldState.itemCounts);
	assert.equal(useUserStore.getState().hasConvertedDeprecatedLegacyState, false);
});

test("dismissal and resets persist only in new storage and never remove the old save", async () => {
	const { storage, original } = setup();
	await useUserStore.persist.rehydrate();
	useUserStore.getState().dismissDeprecatedLegacyState();
	await useUserStore.persist.rehydrate();
	assert.equal(useUserStore.getState().hasDismissedDeprecatedLegacyState, true);
	useUserStore.getState().resetAll();
	await useUserStore.persist.rehydrate();
	assert.equal(useUserStore.getState().deprecatedLegacyState, null);
	assert.equal(storage.getItem(LEGACY_USER_STORE_STORAGE_KEY), original);
});

test("storage failures do not mark conversion complete or replace the in-memory destination", async () => {
	const { storage, original, failWrites } = setup();
	await useUserStore.persist.rehydrate();
	useUserStore.getState().setPlayerLevel(12);
	const before = useUserStore.getState();
	const saved = storage.getItem(USER_STORE_STORAGE_KEY);
	failWrites();
	assert.throws(() => useUserStore.getState().convertDeprecatedLegacyState("PVP"), /Quota/);
	assert.deepEqual(useUserStore.getState().profiles, before.profiles);
	assert.equal(useUserStore.getState().playerLevel, 12);
	assert.equal(useUserStore.getState().hasConvertedDeprecatedLegacyState, false);
	assert.equal(storage.getItem(USER_STORE_STORAGE_KEY), saved);
	assert.equal(storage.getItem(LEGACY_USER_STORE_STORAGE_KEY), original);
});

test("new storage wins over later edits by an old build", async () => {
	const { storage } = setup();
	await useUserStore.persist.rehydrate();
	useUserStore.getState().convertDeprecatedLegacyState("KORD");
	storage.setItem(
		LEGACY_USER_STORE_STORAGE_KEY,
		JSON.stringify({ state: { ...oldState, itemCounts: {} }, version: 15 }),
	);
	await useUserStore.persist.rehydrate();
	assert.deepEqual(useUserStore.getState().itemCounts, oldState.itemCounts);
	assert.equal(useUserStore.getState().hasConvertedDeprecatedLegacyState, true);
});
