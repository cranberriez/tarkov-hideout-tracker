import assert from "node:assert/strict";
import test from "node:test";
import { GRAPHICS_CARD_ITEM_ID } from "../../../lib/cfg/hideout-power";
import type { Station, StationBonus } from "@/types/hideout";
import { bitcoinFarmFigures, comeBackBy, secondsPerBitcoin, secondsUntilFull } from "./bitcoin-farm-model";
import { fuelCostPerHour, fuelMultiplier, fuelRuntimeHours, stationSlots } from "./hideout-power-model";

test("fuel running cost deducts residual value once, preserves unknowns and never becomes negative", () => {
	assert.equal(fuelCostPerHour(200000, 100, 5), 10000);
	assert.equal(fuelCostPerHour(200000, 100, 5, 50000), 7500);
	assert.equal(fuelCostPerHour(200000, 100, 5, 0), 10000);
	assert.equal(fuelCostPerHour(200000, 100, 5, 300000), 0);
	assert.equal(fuelCostPerHour(null, 100, 5, 50000), null);
	assert.equal(fuelCostPerHour(200000, undefined, 5, 50000), null);
});

function station(id: string, bonuses: StationBonus[][]): Station {
	return {
		id,
		name: id,
		normalizedName: id,
		levels: bonuses.map((entries, index) => ({
			id: `${id}-${index + 1}`,
			level: index + 1,
			constructionTime: 0,
			itemRequirements: [],
			stationLevelRequirements: [],
			skillRequirements: [],
			traderRequirements: [],
			bonuses: entries,
		})),
	};
}

const fuel = (value: number): StationBonus => ({ type: "FuelConsumption", value });
const solar = station("solar", [[fuel(-0.5)]]);
const wall = station("wall", [[], [fuel(0.05)], [fuel(0.05)], [fuel(0.05)], [fuel(0.05)], [fuel(-0.2)]]);
const gpuSlots = (value: number): StationBonus => ({
	type: "AdditionalSlots",
	value,
	slotItemIds: [GRAPHICS_CARD_ITEM_ID],
});
const farm = station("farm", [[gpuSlots(10)], [gpuSlots(15)], [gpuSlots(25)]]);

/** Metal fuel tank runtime in seconds for a multiplier. */
function metalTankSeconds(stationLevels: Record<string, number>, hideoutManagementSkillLevel = 0) {
	const { unitsPerHour } = fuelMultiplier({ stations: [solar, wall], stationLevels, hideoutManagementSkillLevel });
	return fuelRuntimeHours(100, unitsPerHour)! * 3600;
}

test("fuel runtime matches the wiki for base, Solar, and Solar with Elite Hideout Management", () => {
	assert.ok(Math.abs(metalTankSeconds({}) - 75_789) < 1); // 21h 03m 09s
	assert.ok(Math.abs(metalTankSeconds({ solar: 1 }) - 151_578) < 1); // 42h 06m 18s
	// 112h 16m 50s; the wiki's base is ~75,789.4 s, so allow its rounding.
	assert.ok(Math.abs(metalTankSeconds({ solar: 1 }, 51) - 404_210) < 3);
});

test("Defective Wall penalties stack across stages and stage 6 cancels them", () => {
	const at = (level: number) =>
		fuelMultiplier({ stations: [wall], stationLevels: { wall: level }, hideoutManagementSkillLevel: 0 });
	assert.ok(Math.abs(at(5).multiplier - 1.2) < 1e-9);
	assert.ok(Math.abs(at(6).multiplier - 1) < 1e-9);
});

test("GPU slots stack across built levels and are unknown without bonus data", () => {
	assert.equal(stationSlots(farm, 0, GRAPHICS_CARD_ITEM_ID), 0);
	assert.equal(stationSlots(farm, 2, GRAPHICS_CARD_ITEM_ID), 25);
	assert.equal(stationSlots(farm, 3, GRAPHICS_CARD_ITEM_ID), 50);
	const legacy: Station = { ...farm, levels: farm.levels.map((level) => ({ ...level, bonuses: undefined })) };
	assert.equal(stationSlots(legacy, 3, GRAPHICS_CARD_ITEM_ID), null);
});

test("Bitcoin production, ROI, and marginal GPU payback", () => {
	assert.equal(secondsPerBitcoin(1, 300_000), 300_000);
	assert.ok(Math.abs(secondsPerBitcoin(50, 300_000)! - 99_337) < 1);
	assert.equal(secondsPerBitcoin(0, 300_000), null);
	const figures = bitcoinFarmFigures({ gpus: 1, baseDuration: 3600, bitcoinPrice: 100, gpuPrice: 50 })!;
	assert.equal(figures.grossPerHour, 100);
	assert.equal(figures.roiHours, 0.5);
	assert.ok(Math.abs(figures.marginalGpuPaybackHours! - 50 / (0.041225 * 100)) < 1e-9);
	assert.equal(bitcoinFarmFigures({ gpus: 1, baseDuration: 3600, bitcoinPrice: null, gpuPrice: 50 })!.roiHours, null);
});

test("full timer uses stored coins and current progress; come back by picks the earlier stop", () => {
	assert.equal(secondsUntilFull({ secondsPerBitcoin: 100, stored: 0, progress: 0 }), 300);
	assert.equal(secondsUntilFull({ secondsPerBitcoin: 100, stored: 1, progress: 0.4 }), 160);
	assert.equal(secondsUntilFull({ secondsPerBitcoin: 100, stored: 3, progress: 0.9 }), 0);
	assert.deepEqual(comeBackBy(160, 90), { seconds: 90, reason: "power" });
	assert.deepEqual(comeBackBy(160, null), { seconds: 160, reason: "full" });
	assert.equal(comeBackBy(null, null), null);
});
