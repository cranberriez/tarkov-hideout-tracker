import { BASE_FUEL_UNITS_PER_HOUR } from "../../../lib/cfg/hideout-power";
import { normalizeHideoutManagementSkillLevel } from "../../../lib/price-calculation/craft-rules";
import type { Station } from "@/types/hideout";

/** One level's FuelConsumption bonus (e.g. Solar Power −0.5, Defective Wall stage 2 +0.05). */
export interface FuelSource {
	stationId: string;
	stationName: string;
	level: number;
	value: number;
}

export interface FuelMultiplier {
	/** Bonuses from built levels; they stack across levels. */
	sources: FuelSource[];
	bonusTotal: number;
	/** Hideout Management raises module bonuses by 1% per level (max 50%). */
	skillBoost: number;
	/** Hideout Management cuts fuel consumption by 0.5% per level (max 25%). */
	skillReduction: number;
	multiplier: number;
	unitsPerHour: number;
	/** No station carries bonus data yet (catalog not refreshed): modifiers are unknown. */
	bonusDataMissing: boolean;
}

function hasBonusData(station: Station) {
	return station.levels.some((level) => level.bonuses !== undefined);
}

/** Slots at the saved level for an item (GPU, fuel tank); null when the station has no bonus data. */
export function stationSlots(station: Station, level: number, itemId: string): number | null {
	if (!hasBonusData(station)) return null;
	let slots = 0;
	for (const entry of station.levels) {
		if (entry.level > level) continue;
		for (const bonus of entry.bonuses ?? []) {
			if (bonus.type === "AdditionalSlots" && bonus.slotItemIds.includes(itemId)) slots += bonus.value;
		}
	}
	return slots;
}

function fuelSources(stations: readonly Station[], include: (station: Station, level: number) => boolean) {
	const sources: FuelSource[] = [];
	for (const station of stations) {
		for (const level of station.levels) {
			if (!include(station, level.level)) continue;
			for (const bonus of level.bonuses ?? []) {
				if (bonus.type !== "FuelConsumption") continue;
				sources.push({ stationId: station.id, stationName: station.name, level: level.level, value: bonus.value });
			}
		}
	}
	return sources;
}

export function fuelMultiplier({
	stations,
	stationLevels,
	hideoutManagementSkillLevel,
}: {
	stations: readonly Station[];
	stationLevels: Record<string, number>;
	hideoutManagementSkillLevel: number;
}): FuelMultiplier {
	const skill = Math.min(50, normalizeHideoutManagementSkillLevel(hideoutManagementSkillLevel));
	const sources = fuelSources(stations, (station, level) => level <= (stationLevels[station.id] ?? 0));
	const bonusTotal = sources.reduce((total, source) => total + source.value, 0);
	const skillBoost = skill * 0.01;
	const skillReduction = skill * 0.005;
	const multiplier = Math.max(0, (1 + bonusTotal * (1 + skillBoost)) * (1 - skillReduction));
	return {
		sources,
		bonusTotal,
		skillBoost,
		skillReduction,
		multiplier,
		unitsPerHour: BASE_FUEL_UNITS_PER_HOUR * multiplier,
		bonusDataMissing: !stations.some(hasBonusData),
	};
}

/** FuelConsumption bonuses on levels above the saved level. */
export function unbuiltFuelSources(stations: readonly Station[], stationLevels: Record<string, number>) {
	return fuelSources(stations, (station, level) => level > (stationLevels[station.id] ?? 0));
}

/** Hours a quantity of fuel units lasts; null when nothing burns. */
export function fuelRuntimeHours(units: number, unitsPerHour: number): number | null {
	return unitsPerHour > 0 && units >= 0 ? units / unitsPerHour : null;
}

export function fuelCostPerHour(
	tankPrice: number | null,
	tankUnits: number | undefined,
	unitsPerHour: number,
	emptyValue = 0,
): number | null {
	if (tankPrice === null || !tankUnits || tankUnits <= 0) return null;
	return (Math.max(0, tankPrice - emptyValue) / tankUnits) * unitsPerHour;
}
