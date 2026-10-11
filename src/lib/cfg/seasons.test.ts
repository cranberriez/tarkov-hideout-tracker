import assert from "node:assert/strict";
import test from "node:test";
import { FIRST_SEASON_ID, getCurrentSeason, getSeason } from "./seasons";
import { getSeasonalCraftingSettings } from "./seasonal";

test("the prior season end determines availability and season rules remain independent", () => {
	const first = getSeason(FIRST_SEASON_ID);
	assert.equal(getCurrentSeason(first.endsAt!).id, "season-1");
	assert.equal(getCurrentSeason(first.endsAt! + 1).id, "season-2");
	assert.equal(getSeason("season-2").endsAt, null);
	assert.equal(getSeasonalCraftingSettings("KORD", 17, "season-1").craftingSkillLevel, 51);
	assert.equal(getSeasonalCraftingSettings("KORD", 17, "season-2").craftingSkillLevel, 17);
	assert.equal(getSeasonalCraftingSettings("PVE", 17, "season-1").craftingSkillLevel, 17);
});
