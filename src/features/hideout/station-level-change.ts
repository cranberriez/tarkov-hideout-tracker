import type { StationLevel } from "@/types/hideout";
import type { ItemSummary } from "@/types/items";
import { isCurrencyItem } from "./station-model";

export interface ItemCountDelta {
	itemId: string;
	haveDelta: number;
	haveFirDelta: number;
}

/**
 * Inventory movement for building (`up`) or refunding (`down`) one station level.
 * Currency always moves plain counts; other FiR requirements move FiR counts.
 */
export function levelChangeItemDeltas(
	level: Pick<StationLevel, "itemRequirements"> | undefined,
	direction: "up" | "down",
	itemById: Readonly<Record<string, ItemSummary>>,
): ItemCountDelta[] {
	const sign = direction === "up" ? -1 : 1;
	return (level?.itemRequirements ?? [])
		.filter((requirement) => requirement.count !== 0)
		.map((requirement) => {
			const fir = requirement.isFir && !isCurrencyItem(itemById[requirement.itemId]);
			return {
				itemId: requirement.itemId,
				haveDelta: fir ? 0 : sign * requirement.count,
				haveFirDelta: fir ? sign * requirement.count : 0,
			};
		});
}
