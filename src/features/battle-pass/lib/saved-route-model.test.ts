import assert from "node:assert/strict";
import test from "node:test";
import type { PassPage } from "./battle-pass-model";
import { lockedRouteStatus, parseSavedRoute, updateSavedRoute, type LockedRoute } from "./saved-route-model";

const page = (num: number, ids: string[]) =>
	({ num, req: 0, cells: ids.map((id, slot) => ({ id, slot })) }) as unknown as PassPage;
const locked: LockedRoute = {
	destination: "finish",
	buyAll: false,
	allProfiles: true,
	useClassified: false,
	savedAt: "2026-11-19T00:00:00.000Z",
	claims: [
		{ rewardId: "a", profileKey: "PVP" },
		{ rewardId: "b", profileKey: "PVE" },
	],
	gathering: 10,
	shortfall: 30,
	completedAtSave: ["old"],
};

test("saved routes keep unknown fields and drop a plan whose claims cannot all be read", () => {
	const raw = updateSavedRoute(JSON.stringify({ future: 1 }), { locked });
	assert.deepEqual(parseSavedRoute(raw).locked, locked);
	assert.equal(JSON.parse(raw).future, 1);
	assert.equal(parseSavedRoute(JSON.stringify({ locked: { ...locked, claims: [{ rewardId: 1 }] } })).locked, null);
	assert.deepEqual(parseSavedRoute("not json").settings, { destination: "finish", buyAll: false, allProfiles: true });
});

test("a saved plan follows progress, reports off-plan claims and breaks on missing rewards or profiles", () => {
	const pages = [page(1, ["old", "a", "x"]), page(2, ["b"])];
	const status = lockedRouteStatus(locked, pages, ["PVP", "PVE"], ["old", "a", "x"]);
	assert.equal(status.kind, "ok");
	if (status.kind === "ok") {
		assert.deepEqual(status.remaining, [{ rewardId: "b", profileKey: "PVE" }]);
		assert.equal(status.completedCount, 1);
		assert.deepEqual(status.offPlan, ["x"]);
	}
	assert.equal(lockedRouteStatus(locked, pages, ["PVP"], []).kind, "broken");
	// A completed claim no longer needs its profile.
	assert.equal(lockedRouteStatus(locked, pages, ["PVE"], ["a"]).kind, "ok");
	assert.equal(lockedRouteStatus(locked, [page(1, ["a"])], ["PVP", "PVE"], []).kind, "broken");
});
