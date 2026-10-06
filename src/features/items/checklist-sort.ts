import { compareQuestItemState, type DerivedQuestItemState } from "../../lib/quests/quest-item-index";
import type { ItemSummary } from "@/types/items";
import { computeNeeds } from "../../lib/utils/item-needs";
import { getBestTraderOffer } from "../../lib/price-calculation/prices";
import { getFleaPrice } from "../../lib/utils/market-price";

export type ChecklistSortKey = "default" | "unitValue" | "alphabetic" | "totalValue" | "quantity";
export type ChecklistSort = { key: ChecklistSortKey; direction: "asc" | "desc" };
export const DEFAULT_CHECKLIST_SORT: ChecklistSort = { key: "unitValue", direction: "desc" };
export const CHECKLIST_SORT_OPTIONS: { key: ChecklistSortKey; label: string }[] = [
	{ key: "default", label: "Default" },
	{ key: "unitValue", label: "Individual Value" },
	{ key: "alphabetic", label: "Alphabetic" },
	{ key: "totalValue", label: "Total Value" },
	{ key: "quantity", label: "Quantity Needed" },
];

export function selectChecklistSort(current: ChecklistSort, key: ChecklistSortKey): ChecklistSort {
	return {
		key,
		direction:
			current.key === key
				? current.direction === "asc"
					? "desc"
					: "asc"
				: key === "alphabetic" || key === "default"
					? "asc"
					: "desc",
	};
}

export interface ChecklistSortValues {
	questState?: DerivedQuestItemState;
	groupOrder?: number;
	id: string;
	name: string;
	unitValue: number | null;
	totalValue: number | null;
	quantity: number;
	fir: number;
}

export function itemChecklistSortValues(
	item: ItemSummary,
	count: number,
	firCount: number,
	owned?: { have: number; haveFir: number },
): ChecklistSortValues {
	const isCurrency = ["roubles", "dollars", "euros"].includes(item.normalizedName);
	const needs = computeNeeds({
		totalRequired: count,
		requiredFir: firCount,
		haveNonFir: isCurrency ? 0 : (owned?.have ?? 0),
		haveFir: isCurrency ? 0 : (owned?.haveFir ?? 0),
	});
	const fleaValue = item.onFleaMarket === false ? null : getFleaPrice(item.marketPrice);
	const traderValue = getBestTraderOffer(item)?.priceRUB ?? null;
	const unitValue =
		fleaValue === null ? traderValue : traderValue === null ? fleaValue : Math.max(fleaValue, traderValue);
	return {
		id: item.id,
		name: item.name,
		unitValue,
		totalValue: unitValue === null ? null : unitValue * needs.neededTotal,
		quantity: needs.neededTotal,
		fir: needs.neededFir,
	};
}

export function compareChecklistEntries(a: ChecklistSortValues, b: ChecklistSortValues, sort: ChecklistSort): number {
	const direction = sort.direction === "asc" ? 1 : -1;
	const alphabetic = a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
	if (sort.key === "default") {
		if (a.groupOrder !== undefined || b.groupOrder !== undefined) {
			return (
				direction *
				(a.groupOrder !== undefined && b.groupOrder !== undefined
					? a.groupOrder - b.groupOrder
					: a.groupOrder !== undefined
						? -1
						: 1)
			);
		}
		if (a.questState && b.questState) {
			const byQuest = compareQuestItemState(a.questState, b.questState);
			if (byQuest !== 0) return direction * byQuest;
		} else if (a.questState || b.questState) {
			return direction * (a.questState ? -1 : 1);
		}
		return direction * alphabetic;
	}
	if (sort.key === "alphabetic") return direction * alphabetic;
	const left = a[sort.key];
	const right = b[sort.key];
	// Unknown values (including any-of groups) stay after known values in either direction.
	if (left === null || right === null) {
		if (left !== right) return left === null ? 1 : -1;
		return alphabetic;
	}
	return direction * (left - right) || (sort.key === "quantity" ? direction * (a.fir - b.fir) : 0) || alphabetic;
}
