import { isTrackedCraft } from "@/lib/price-calculation/craft-rules";
import type { CraftRecord } from "@/types/recipes";

export type CraftLock = { kind: "station"; level: number } | { kind: "quest"; questId: string } | null;

/** Tracked crafts for one station, by unlock level then output name (as displayed). */
export function stationCrafts(
	crafts: readonly CraftRecord[],
	stationId: string,
	outputName: (itemId: string) => string,
): CraftRecord[] {
	return crafts
		.filter((craft) => craft.stationId === stationId && isTrackedCraft(craft))
		.sort(
			(a, b) =>
				a.level - b.level ||
				outputName(a.productItemId).localeCompare(outputName(b.productItemId)) ||
				a.duration - b.duration,
		);
}

/** Default: crafts unlocked at the saved level. `allLevels` adds locked higher-level crafts. */
export function filterCrafts(crafts: readonly CraftRecord[], allLevels: boolean, currentLevel: number): CraftRecord[] {
	return allLevels ? [...crafts] : crafts.filter((craft) => craft.level <= currentLevel);
}

export function groupCraftsByLevel(crafts: readonly CraftRecord[]) {
	const groups = new Map<number, CraftRecord[]>();
	for (const craft of crafts) groups.set(craft.level, [...(groups.get(craft.level) ?? []), craft]);
	return [...groups.entries()].map(([level, entries]) => ({ level, crafts: entries }));
}

export function craftLock(
	craft: CraftRecord,
	currentLevel: number,
	completedQuests: Readonly<Record<string, boolean>>,
): CraftLock {
	if (currentLevel < craft.level) return { kind: "station", level: craft.level };
	if (craft.taskUnlockId && completedQuests[craft.taskUnlockId] !== true) {
		return { kind: "quest", questId: craft.taskUnlockId };
	}
	return null;
}

/**
 * Badge text for a craft amount. Continuous crafts consume part of an item per run
 * (e.g. 0.66 of a water filter), shown as a percentage; single units show nothing.
 */
export function formatCraftQuantity(count: number): string | undefined {
	if (count > 0 && count < 1) return `${Math.round(count * 100)}%`;
	if (count > 1) return `×${Number(count.toFixed(2))}`;
	return undefined;
}
