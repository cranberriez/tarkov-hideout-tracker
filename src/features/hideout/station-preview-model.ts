import type { Station } from "../../types/hideout";
import type { ItemSummary } from "../../types/items";
import { missingRequirementCount, type CostInputs } from "./details/station-details-model";
import { findRequiredStation, isCurrencyItem } from "./station-model";

export interface StationPreviewRequirement {
	id: string;
	name: string;
	item?: ItemSummary;
	count?: number;
	level?: number;
	kind: "item" | "station" | "trader" | "skill";
	isFir?: boolean;
	untracked?: boolean;
	unresolved?: boolean;
}

/** Only the immediate next upgrade; unknown data never counts as satisfied. */
export function getStationPreviewUpgrade({
	station,
	stations,
	stationLevels,
	traderLevelsByName,
	...inputs
}: Omit<CostInputs, "pooledFirByItem"> & {
	station: Pick<Station, "id"> & Partial<Station>;
	stations: readonly Station[];
	stationLevels: Readonly<Record<string, number>>;
	traderLevelsByName: Readonly<Record<string, number>>;
}) {
	const currentLevel = stationLevels[station.id] ?? 0;
	if (!station.levels?.length) return { status: "unavailable" as const, level: null, rows: [] };
	const maxLevel = Math.max(...station.levels.map((level) => level.level));
	if (currentLevel >= maxLevel) return { status: "maxed" as const, level: null, rows: [] };
	const next = station.levels.find((level) => level.level === currentLevel + 1);
	if (!next) return { status: "unavailable" as const, level: null, rows: [] };
	const rows: StationPreviewRequirement[] = [];
	// Reserve FiR only for this upgrade, never for other stations or later levels.
	const firRequiredByItem: Record<string, number> = {};
	for (const requirement of next.itemRequirements) {
		if (requirement.isFir && !inputs.completedRequirements[requirement.id]) {
			firRequiredByItem[requirement.itemId] = (firRequiredByItem[requirement.itemId] ?? 0) + requirement.count;
		}
	}
	for (const requirement of next.itemRequirements) {
		if (inputs.completedRequirements[requirement.id]) continue;
		const item = inputs.itemById[requirement.itemId];
		const owned = inputs.itemCounts[requirement.itemId];
		const count = item
			? missingRequirementCount(
					requirement,
					item,
					// Signed balances are retained in saves, but debt isn't an upgrade requirement.
					{ have: Math.max(0, owned?.have ?? 0), haveFir: Math.max(0, owned?.haveFir ?? 0) },
					firRequiredByItem[requirement.itemId] ?? 0,
				)
			: requirement.count;
		if (count <= 0) continue;
		rows.push({
			id: requirement.id,
			name: item?.name ?? `Unknown item (${requirement.itemId})`,
			kind: "item",
			item,
			count,
			isFir: requirement.isFir,
			untracked: item ? isCurrencyItem(item) : false,
			unresolved: !item,
		});
	}
	for (const [index, requirement] of (next.stationLevelRequirements ?? []).entries()) {
		if (requirement.station.normalizedName === station.normalizedName) continue;
		const required = findRequiredStation(stations, requirement);
		if (required && (stationLevels[required.id] ?? 0) >= requirement.level) continue;
		rows.push({
			id: `station-${index}`,
			name: required?.name ?? requirement.station.normalizedName.replaceAll("-", " "),
			kind: "station",
			level: requirement.level,
			unresolved: !required,
		});
	}
	for (const [index, requirement] of (next.traderRequirements ?? []).entries()) {
		const current = traderLevelsByName[requirement.trader.normalizedName];
		if (current != null && current >= requirement.value) continue;
		rows.push({
			id: `trader-${index}`,
			name: requirement.trader.name,
			kind: "trader",
			level: requirement.value,
			untracked: current == null,
		});
	}
	// General character skills are not saved by the tracker.
	for (const [index, requirement] of (next.skillRequirements ?? []).entries()) {
		rows.push({
			id: `skill-${index}`,
			name: requirement.skill.name,
			kind: "skill",
			level: requirement.level,
			untracked: true,
		});
	}
	return { status: "next" as const, level: next.level, rows };
}
