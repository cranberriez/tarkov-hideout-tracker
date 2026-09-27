import "../settings/progress-backup-test-storage";
import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultPlayerProfile } from "../../lib/stores/useUserStore";
import { STATIC_STATIONS } from "../../lib/data/static-stations";
import { hasProfileData } from "./profile-data";

const stash = STATIC_STATIONS.find((station) => station.normalizedName === "stash")!;

function initializedProfile() {
	return {
		...createDefaultPlayerProfile(),
		stationLevels: Object.fromEntries(STATIC_STATIONS.map((station) => [station.id, station.id === stash.id ? 1 : 0])),
	};
}

test("untouched profiles remain empty before and after default station initialization", () => {
	assert.equal(hasProfileData(createDefaultPlayerProfile()), false);
	assert.equal(hasProfileData(initializedProfile()), false);
});

test("real progress still requires conversion overwrite review alongside the default stash", () => {
	const profile = initializedProfile();
	for (const patch of [
		{ stationLevels: { ...profile.stationLevels, [stash.id]: 2 } },
		{ stationLevels: { ...profile.stationLevels, "another-station": 1 } },
		{ itemCounts: { item: { have: 1, haveFir: 0 } } },
		{ itemCounts: { item: { have: 0, haveFir: 1 } } },
		{ itemCounts: { item: { have: -1, haveFir: 0 } } },
		{ completedRequirements: { requirement: true } },
		{ completedQuests: { quest: true } },
		{ hasCompletedSetup: true },
		{ gameEdition: "Standard" as const },
	]) {
		assert.equal(hasProfileData({ ...profile, ...patch }), true, JSON.stringify(patch));
	}
});
