import "./progress-backup-test-storage";
import assert from "node:assert/strict";
import test from "node:test";
import { createJSONStorage } from "zustand/middleware";
import { useUserStore, USER_STORE_STORAGE_KEY } from "../../lib/stores/useUserStore";
import { useKappaStore, KAPPA_STORE_STORAGE_KEY } from "../../lib/stores/useKappaStore";
import { canonical, comparisonRows, emptyBackupProfile, parseProgressBackup, profileStatus } from "./progress-backup";
import { importProgressBackup, readProgressBackup, selectBackupProfiles } from "./progress-backup-storage";
import { profitOptionsStorageKey } from "../profit-pages/profit-options";

function setup() {
	const values = new Map<string, string>();
	let failKey: string | null = null;
	const storage: Storage = {
		get length() {
			return values.size;
		},
		key: (index) => [...values.keys()][index] ?? null,
		clear: () => values.clear(),
		getItem: (key) => values.get(key) ?? null,
		removeItem: (key) => {
			values.delete(key);
		},
		setItem: (key, value) => {
			if (failKey === key) {
				failKey = null;
				throw new Error("Quota exceeded");
			}
			values.set(key, value);
		},
	};
	useUserStore.persist.setOptions({ storage: createJSONStorage(() => storage) });
	useKappaStore.persist.setOptions({ storage: createJSONStorage(() => storage) });
	useUserStore.getState().resetAll();
	useKappaStore.getState().resetAll();
	return {
		storage,
		values,
		failOnce: (key: string) => {
			failKey = key;
		},
	};
}

test("round-trips all progression owners and excludes UI, pricing, and planning state", () => {
	const { storage } = setup();
	const user = useUserStore.getState();
	user.setPlayerLevel(40);
	user.addItemCounts("item", 3, 2);
	user.addItemCounts("consumed-item", -12, -3);
	user.toggleQuestCompletion("quest");
	user.toggleQuestObjectiveCompletion("quest-two", "objective");
	user.setStationLevel("station", 3);
	user.toggleHiddenStation("hidden");
	user.togglePinnedQuest("pinned");
	user.setShowFirOnly(true);
	useKappaStore.getState().toggleCompletedItem("KORD", "collector");
	storage.setItem(
		profitOptionsStorageKey("PVP"),
		JSON.stringify({ craftingSkillLevel: 31, hideoutManagementSkillLevel: 12, profitableOnly: true }),
	);
	const backup = readProgressBackup(storage);
	assert.deepEqual(parseProgressBackup(JSON.stringify(backup)), backup);
	assert.equal(backup.profiles.PVP!.progress.playerLevel, 40);
	assert.deepEqual(backup.profiles.PVP!.progress.itemCounts.item, { have: 3, haveFir: 2 });
	assert.deepEqual(backup.profiles.PVP!.progress.itemCounts["consumed-item"], { have: -12, haveFir: -3 });
	assert.equal(backup.profiles.KORD!.kappa.collector, true);
	assert.equal(backup.profiles.PVP!.skills.craftingSkillLevel, 31);
	for (const field of ["hiddenStations", "pinnedQuests", "ignoredQuests", "showFirOnly", "questShowKappa", "gameMode"])
		assert.equal(field in backup.profiles.PVP!.progress, false);
	assert.equal("profitableOnly" in backup.profiles.PVP!.skills, false);
	assert.deepEqual(Object.keys(selectBackupProfiles(backup, ["PVE"]).profiles), ["PVE"]);
});

test("rejects malformed, unsupported, incomplete and unsafe files without mutation", () => {
	const { storage } = setup();
	const backup = readProgressBackup(storage);
	const cases = [
		"not json",
		"{}",
		JSON.stringify({ ...backup, version: 2 }),
		JSON.stringify({ ...backup, profiles: {} }),
		JSON.stringify({ ...backup, profiles: { XYZ: backup.profiles.PVP } }),
	];
	for (const mutate of [
		(p: Record<string, unknown>) => {
			delete p.itemCounts;
		},
		(p: Record<string, unknown>) => {
			p.playerLevel = "42";
		},
		(p: Record<string, unknown>) => {
			p.itemCounts = { item: { have: 1.5, haveFir: 0 } };
		},
		(p: Record<string, unknown>) => {
			p.completedQuests = { quest: "true" };
		},
		(p: Record<string, unknown>) => {
			p.stationLevels = JSON.parse('{"__proto__":2}');
		},
		(p: Record<string, unknown>) => {
			p.stationLevels = { station: 1e100 };
		},
		(p: Record<string, unknown>) => {
			p.questTraderLoyaltyLevels = { trader: 5 };
		},
		(p: Record<string, unknown>) => {
			p.questChangeHistory = [{ questId: "q", change: "failed", timestamp: 1 }];
		},
		(p: Record<string, unknown>) => {
			p.showHidden = true;
		},
	]) {
		const invalid = structuredClone(backup);
		mutate(invalid.profiles.PVP!.progress as unknown as Record<string, unknown>);
		cases.push(JSON.stringify(invalid));
	}
	for (const raw of cases) assert.throws(() => parseProgressBackup(raw));
	assert.equal(canonical(readProgressBackup(storage).profiles), canonical(backup.profiles));
});

test("detects defaults and identical reordered maps; shows changed data even with equal counts", () => {
	const current = emptyBackupProfile();
	const incoming = emptyBackupProfile();
	assert.equal(profileStatus(current, incoming), "up-to-date");
	incoming.progress.itemCounts = { b: { have: 2, haveFir: 1 }, a: { have: 1, haveFir: 0 } };
	assert.equal(profileStatus(current, incoming), "empty");
	current.progress.itemCounts = { a: { have: 1, haveFir: 0 }, b: { haveFir: 1, have: 2 } };
	assert.equal(profileStatus(current, incoming), "up-to-date");
	incoming.progress.itemCounts.a.have = 3;
	assert.equal(profileStatus(current, incoming), "replace");
	assert.equal(comparisonRows(current, incoming).find((row) => row.label.startsWith("Stored items"))!.changed, true);
});

test("replaces only selected progression, preserves preferences, reloads and switches modes", async () => {
	const { storage } = setup();
	useUserStore.getState().setPlayerLevel(20);
	useUserStore.getState().setStationLevel("removed-by-import", 2);
	useUserStore.getState().toggleHiddenStation("hidden");
	useUserStore.getState().setShowFirOnly(true);
	useKappaStore.getState().setViewMode("need");
	storage.setItem(profitOptionsStorageKey("PVP"), JSON.stringify({ profitableOnly: true, customFuturePreference: 1 }));
	const current = readProgressBackup(storage);
	const incoming = structuredClone(current);
	incoming.profiles.PVP!.progress = emptyBackupProfile().progress;
	incoming.profiles.PVP!.progress.playerLevel = 42;
	incoming.profiles.PVP!.progress.itemCounts = { incoming: { have: 3, haveFir: 1 } };
	incoming.profiles.PVP!.kappa = { completed: true };
	incoming.profiles.PVP!.skills.craftingSkillLevel = 25;
	incoming.profiles.PVE!.progress.playerLevel = 50;
	assert.equal(importProgressBackup(incoming, current, ["PVP"], storage), 1);
	assert.equal(useUserStore.getState().playerLevel, 42);
	assert.deepEqual(useUserStore.getState().stationLevels, {});
	assert.equal(useUserStore.getState().hiddenStations.hidden, true);
	assert.equal(useUserStore.getState().showFirOnly, true);
	assert.equal(useKappaStore.getState().viewMode, "need");
	assert.equal(JSON.parse(storage.getItem(profitOptionsStorageKey("PVP"))!).customFuturePreference, 1);
	await useUserStore.persist.rehydrate();
	await useKappaStore.persist.rehydrate();
	assert.equal(useUserStore.getState().playerLevel, 42);
	assert.equal(useKappaStore.getState().completedItemsByMode.PVP!.completed, true);
	useUserStore.getState().setGameMode("PVE");
	assert.equal(useUserStore.getState().playerLevel, 1);
	useUserStore.getState().setGameMode("PVP");
	assert.equal(useUserStore.getState().playerLevel, 42);
	assert.equal(useUserStore.getState().itemCounts.incoming.haveFir, 1);
	const latest = readProgressBackup(storage);
	assert.equal(importProgressBackup(incoming, latest, ["PVP"], storage), 0);
});

test("backups preserve migrated v22 progression and existing reset scopes", async () => {
	const { storage } = setup();
	useUserStore.getState().setPlayerLevel(24);
	useUserStore.getState().setStationLevel("old-station", 2);
	useUserStore.getState().addItemCounts("old-item", -4, 1);
	const old = JSON.parse(storage.getItem(USER_STORE_STORAGE_KEY)!);
	old.version = 22;
	delete old.state.completedQuestObjectives;
	for (const profile of Object.values(old.state.profiles) as Array<Record<string, unknown>>)
		delete profile.completedQuestObjectives;
	storage.setItem(USER_STORE_STORAGE_KEY, JSON.stringify(old));
	await useUserStore.persist.rehydrate();
	const backup = parseProgressBackup(JSON.stringify(readProgressBackup(storage)));
	assert.equal(backup.profiles.PVP!.progress.playerLevel, 24);
	assert.deepEqual(backup.profiles.PVP!.progress.completedQuestObjectives, {});
	assert.equal(backup.profiles.PVP!.progress.itemCounts["old-item"].have, -4);
	useUserStore.getState().resetHideoutData();
	assert.deepEqual(useUserStore.getState().stationLevels, {});
	assert.equal(useUserStore.getState().itemCounts["old-item"].have, -4);
	assert.equal(useUserStore.getState().playerLevel, 24);
	const reviewed = readProgressBackup(storage);
	importProgressBackup(backup, reviewed, ["PVP"], storage);
	assert.equal(useUserStore.getState().stationLevels["old-station"], 2);
	useUserStore.getState().resetItemData();
	assert.deepEqual(useUserStore.getState().itemCounts, {});
	assert.equal(useUserStore.getState().stationLevels["old-station"], 2);
});

test("inactive import keeps active projection and rejects stale previews", () => {
	const { storage } = setup();
	const current = readProgressBackup(storage);
	const incoming = structuredClone(current);
	incoming.profiles.KORD!.progress.playerLevel = 15;
	importProgressBackup(incoming, current, ["KORD"], storage);
	assert.equal(useUserStore.getState().playerLevel, 1);
	useUserStore.getState().setGameMode("KORD");
	assert.equal(useUserStore.getState().playerLevel, 15);
	assert.throws(() => importProgressBackup(incoming, current, ["KORD"], storage), /changed since/);
});

test("rolls back all writes and in-memory progression if any owner fails to save", () => {
	for (const key of [profitOptionsStorageKey("PVE"), USER_STORE_STORAGE_KEY, KAPPA_STORE_STORAGE_KEY]) {
		const { storage, values, failOnce } = setup();
		useUserStore.getState().setPlayerLevel(7);
		const current = readProgressBackup(storage);
		const incoming = structuredClone(current);
		incoming.profiles.PVP!.progress.playerLevel = 42;
		incoming.profiles.PVE!.progress.playerLevel = 30;
		const before = new Map(values);
		failOnce(key);
		assert.throws(() => importProgressBackup(incoming, current, ["PVP", "PVE"], storage), /restored/);
		assert.deepEqual(values, before);
		assert.equal(useUserStore.getState().playerLevel, 7);
		assert.equal(canonical(readProgressBackup(storage).profiles), canonical(current.profiles));
	}
});
