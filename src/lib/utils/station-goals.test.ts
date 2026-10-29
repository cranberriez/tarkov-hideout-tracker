import assert from "node:assert/strict";
import test from "node:test";
import type { Station, StationLevel } from "../../types/hideout";
import { resolveStationGoals } from "./station-goals";

function level(levelNumber: number, requires: [string, number][] = []): StationLevel {
	return {
		id: `level-${levelNumber}`,
		level: levelNumber,
		constructionTime: 0,
		itemRequirements: [],
		stationLevelRequirements: requires.map(([normalizedName, required]) => ({
			station: { normalizedName },
			level: required,
		})),
		skillRequirements: [],
		traderRequirements: [],
	};
}

const generator: Station = {
	id: "gen",
	name: "Generator",
	normalizedName: "generator",
	levels: [1, 2, 3].map((n) => level(n)),
};
const vents: Station = { id: "vents", name: "Vents", normalizedName: "vents", levels: [1, 2, 3].map((n) => level(n)) };
const intel: Station = {
	id: "intel",
	name: "Intelligence Center",
	normalizedName: "intelligence-center",
	levels: [level(1, [["vents", 1]]), level(2, [["generator", 2]]), level(3, [["generator", 3]])],
};

test("raises goals to cover other goals' unbuilt prerequisites, transitively", () => {
	const chained: Station = { ...vents, levels: [level(1), level(2, [["intelligence-center", 2]]), level(3)] };
	const goals = resolveStationGoals([generator, chained, intel], { intel: 0 }, { gen: 0, intel: 0, vents: 2 });

	assert.equal(goals.vents.cap, 2);
	assert.equal(goals.intel.cap, 2);
	assert.equal(goals.gen.cap, 2);
	assert.deepEqual(
		goals.gen.requiredBy.map((entry) => [entry.stationId, entry.level, entry.requiredLevel]),
		[["intel", 2, 2]],
	);
});

test("unset goals count every level and built prerequisites raise nothing", () => {
	const goals = resolveStationGoals([generator, vents, intel], { gen: 3, intel: 2 }, { gen: 0 });

	assert.equal(goals.intel.cap, 3);
	assert.equal(goals.gen.cap, 0);
	assert.deepEqual(goals.gen.requiredBy, []);
	assert.equal(goals.vents.cap, 3);
});
