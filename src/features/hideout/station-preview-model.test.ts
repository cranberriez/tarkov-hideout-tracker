import test from "node:test";
import assert from "node:assert/strict";
import type { Station, StationLevel } from "../../types/hideout";
import { getStationPreviewUpgrade } from "./station-preview-model";

function level(value: number, overrides: Partial<StationLevel> = {}): StationLevel {
	return {
		id: `level-${value}`,
		level: value,
		constructionTime: 0,
		itemRequirements: [],
		stationLevelRequirements: [],
		skillRequirements: [],
		traderRequirements: [],
		...overrides,
	};
}
const station: Station = {
	id: "bench",
	name: "Workbench",
	normalizedName: "workbench",
	levels: [
		level(1),
		level(2, {
			itemRequirements: [
				{ id: "bolts", itemId: "bolts", count: 5, isFir: false, isTool: false },
				{ id: "fir", itemId: "fir", count: 3, isFir: true, isTool: false },
			],
		}),
		level(3, { itemRequirements: [{ id: "future", itemId: "bolts", count: 10, isFir: true, isTool: false }] }),
	],
};
const inputs = {
	station,
	stations: [station],
	stationLevels: { bench: 1 },
	itemById: {
		bolts: { id: "bolts", name: "Bolts", normalizedName: "bolts" },
		fir: { id: "fir", name: "FiR item", normalizedName: "fir" },
	},
	itemCounts: { bolts: { have: 3, haveFir: 2 }, fir: { have: 10, haveFir: 1 } },
	completedRequirements: {},
	traderLevelsByName: {},
};

test("next upgrade uses owned FiR without reserving it for later levels", () => {
	const result = getStationPreviewUpgrade(inputs);
	assert.equal(result.level, 2);
	assert.deepEqual(
		result.rows.map((row) => [row.id, row.count]),
		[["fir", 2]],
	);
	assert.equal(result.rows[0].isFir, true);
});
test("FiR reservation applies only to requirements in the same next upgrade", () => {
	const next = level(2, {
		itemRequirements: [
			{ id: "ordinary", itemId: "bolts", count: 5, isFir: false, isTool: false },
			{ id: "raid", itemId: "bolts", count: 1, isFir: true, isTool: false },
		],
	});
	const result = getStationPreviewUpgrade({ ...inputs, station: { ...station, levels: [next] } });
	assert.deepEqual(
		result.rows.map((row) => [row.id, row.count]),
		[["ordinary", 1]],
	);
});
test("covered inventory and manually completed requirements are omitted", () => {
	const result = getStationPreviewUpgrade({ ...inputs, completedRequirements: { fir: true } });
	assert.deepEqual(result.rows, []);
});
test("negative saved inventory cannot inflate next-level requirements", () => {
	const result = getStationPreviewUpgrade({
		...inputs,
		itemCounts: { bolts: { have: -34, haveFir: -2 }, fir: { have: -10, haveFir: -7 } },
	});
	assert.deepEqual(
		result.rows.map((row) => [row.id, row.count]),
		[
			["bolts", 5],
			["fir", 3],
		],
	);
});
test("maxed and missing level metadata are distinct states", () => {
	assert.equal(getStationPreviewUpgrade({ ...inputs, stationLevels: { bench: 3 } }).status, "maxed");
	assert.equal(
		getStationPreviewUpgrade({ ...inputs, station: { id: "bench", name: "Workbench" } }).status,
		"unavailable",
	);
});
test("missing catalog records stay unresolved even when inventory appears sufficient", () => {
	const result = getStationPreviewUpgrade({ ...inputs, itemById: {} });
	assert.equal(result.rows.length, 2);
	assert.ok(result.rows.every((row) => row.unresolved));
});
test("met gates are omitted; unknown station and skill requirements stay visible", () => {
	const gated: Station = {
		...station,
		levels: [
			level(1),
			level(2, {
				stationLevelRequirements: [
					{ station: { normalizedName: "generator" }, level: 2 },
					{ station: { normalizedName: "unknown" }, level: 1 },
				],
				traderRequirements: [{ trader: { name: "Mechanic", normalizedName: "mechanic" }, value: 2 }],
				skillRequirements: [{ name: "Strength", skill: { name: "Strength" }, level: 3 }],
				itemRequirements: [{ id: "money", itemId: "money", count: 100000, isFir: false, isTool: false }],
			}),
		],
	};
	const result = getStationPreviewUpgrade({
		...inputs,
		station: gated,
		stations: [gated, { id: "gen", name: "Generator", normalizedName: "generator", levels: [level(1), level(2)] }],
		stationLevels: { bench: 1, gen: 2 },
		traderLevelsByName: { mechanic: 2 },
		itemById: { money: { id: "money", name: "Roubles", normalizedName: "roubles" } },
	});
	assert.deepEqual(
		result.rows.map((row) => row.kind),
		["item", "station", "skill"],
	);
	assert.equal(result.rows[0].untracked, true);
	assert.equal(result.rows[1].unresolved, true);
	assert.equal(result.rows[2].untracked, true);
});
