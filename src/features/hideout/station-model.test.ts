import assert from "node:assert/strict";
import test from "node:test";
import type { Station, StationLevel } from "@/types/hideout";
import type { ItemSummary } from "@/types/items";
import { computeStationUpgradeStatus, defaultViewedLevel, getStationDependents } from "./station-model";

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

const generator: Station = {
	id: "gen",
	name: "Generator",
	normalizedName: "generator",
	levels: [level(1), level(2), level(3)],
};
const workbench: Station = {
	id: "wb",
	name: "Workbench",
	normalizedName: "workbench",
	levels: [
		level(1, {
			stationLevelRequirements: [{ station: { normalizedName: "generator" }, level: 1 }],
			itemRequirements: [
				{ id: "bolts", itemId: "bolts", count: 2, isFir: false, isTool: false },
				{ id: "roubles", itemId: "rub", count: 5000, isFir: false, isTool: false },
			],
		}),
		level(2, {
			stationLevelRequirements: [{ station: { normalizedName: "generator" }, level: 3 }],
			itemRequirements: [{ id: "fir-gpu", itemId: "gpu", count: 1, isFir: true, isTool: false }],
		}),
	],
};
const stations = [generator, workbench];
const items: Record<string, ItemSummary> = {
	bolts: { id: "bolts", name: "Bolts", normalizedName: "bolts" },
	rub: { id: "rub", name: "Roubles", normalizedName: "roubles" },
	gpu: { id: "gpu", name: "GPU", normalizedName: "gpu" },
};

function status(
	stationLevels: Record<string, number>,
	itemCounts: Record<string, { have: number; haveFir: number }>,
	itemById = items,
	pooledFirByItem: Record<string, number> = {},
) {
	return computeStationUpgradeStatus({
		station: workbench,
		stations,
		stationLevels,
		itemById,
		itemCounts,
		pooledFirByItem,
	});
}

test("upgrade is ready when station and non-currency item requirements are met", () => {
	assert.equal(status({ gen: 1 }, { bolts: { have: 2, haveFir: 0 } }), "ready");
	assert.equal(status({ gen: 0 }, { bolts: { have: 2, haveFir: 0 } }), "missing");
	assert.equal(status({ gen: 1 }, { bolts: { have: 1, haveFir: 0 } }), "missing");
});

test("surplus FiR counts toward non-FiR needs only beyond pooled FiR demand", () => {
	assert.equal(status({ gen: 1 }, { bolts: { have: 0, haveFir: 2 } }), "ready");
	assert.equal(status({ gen: 1 }, { bolts: { have: 0, haveFir: 2 } }, items, { bolts: 1 }), "missing");
});

test("FiR requirements need FiR copies and missing item data never satisfies", () => {
	assert.equal(status({ gen: 3, wb: 1 }, { gpu: { have: 5, haveFir: 0 } }), "missing");
	assert.equal(status({ gen: 3, wb: 1 }, { gpu: { have: 0, haveFir: 1 } }), "ready");
	const withoutGpu = Object.fromEntries(Object.entries(items).filter(([id]) => id !== "gpu"));
	assert.equal(status({ gen: 3, wb: 1 }, { gpu: { have: 0, haveFir: 1 } }, withoutGpu), "missing");
});

test("a current level whose prerequisites are no longer met is illegal", () => {
	assert.equal(status({ gen: 0, wb: 1 }, {}), "illegal");
});

test("the viewed level defaults to the next upgrade, or the last level when maxed", () => {
	assert.equal(defaultViewedLevel(workbench, 0), 1);
	assert.equal(defaultViewedLevel(workbench, 1), 2);
	assert.equal(defaultViewedLevel(workbench, 2), 2);
	assert.equal(defaultViewedLevel({ levels: [] }, 0), null);
});

test("dependents list stations that require the viewed station", () => {
	assert.deepEqual(
		getStationDependents(stations, generator).map((entry) => [entry.station.id, entry.level, entry.requiresLevel]),
		[
			["wb", 1, 1],
			["wb", 2, 3],
		],
	);
	assert.deepEqual(getStationDependents(stations, workbench), []);
});
