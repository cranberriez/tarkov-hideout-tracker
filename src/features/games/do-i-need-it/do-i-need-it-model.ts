import { itemGroup } from "@/lib/data/item-groups";
import type { ItemSummary } from "@/types/items";
import type { UploaderSummaryData } from "@/types/uploader";
import { isCurrencyItem } from "../../hideout/station-model";
import type { ItemNeed } from "../../items/demand/item-demand-model";

/** Items shown and how many of them are needed, per round; the last shape repeats. */
const ROUND_SHAPES: ReadonlyArray<readonly [total: number, needed: number]> = [
	[10, 4],
	[9, 4],
	[8, 3],
	[7, 3],
	[6, 2],
	[5, 2],
	[4, 1],
	[3, 1],
];
const PRESET_ID_PREFIX = "707265736574";
const PLACEHOLDER_IMAGE = "unknown-item";

export interface NeedRound {
	items: ItemSummary[];
	needed: ReadonlySet<string>;
}

export function roundShape(round: number) {
	return ROUND_SHAPES[Math.min(round, ROUND_SHAPES.length - 1)];
}

/** Real, recognisable items: no currency, presets, quest-chain items or placeholder art. */
export function isPlayableItem(item: ItemSummary): boolean {
	return (
		!!item.categoryId &&
		!item.questOnly &&
		!item.id.startsWith(PRESET_ID_PREFIX) &&
		!item.name.endsWith(" Default") &&
		!item.iconLink?.includes(PLACEHOLDER_IMAGE) &&
		!isCurrencyItem(item)
	);
}

/** Every item a hideout level or quest hand-in names, so demand is resolved for each of them. */
export function requirementItemIds(data: UploaderSummaryData): Set<string> {
	const ids = new Set<string>();
	for (const station of data.stations)
		for (const level of station.levels) for (const requirement of level.itemRequirements) ids.add(requirement.itemId);
	for (const quest of data.quests) for (const objective of quest.objectives) for (const id of objective.itemIds ?? []) ids.add(id);
	return ids;
}

function shuffle<T>(values: readonly T[], random: () => number): T[] {
	const copy = [...values];
	for (let index = copy.length - 1; index > 0; index -= 1) {
		const swap = Math.floor(random() * (index + 1));
		[copy[index], copy[swap]] = [copy[swap], copy[index]];
	}
	return copy;
}

/**
 * One round: unused needed items plus decoys the player does not need, drawn first from the needed items'
 * own categories, then their broader item group, then anywhere. Returns null when nothing needed is left.
 */
export function buildNeedRound(
	catalog: readonly ItemSummary[],
	needs: ReadonlyMap<string, ItemNeed>,
	usedNeeded: ReadonlySet<string>,
	round: number,
	random: () => number = Math.random,
): NeedRound | null {
	const [total, wanted] = roundShape(round);
	const needed = shuffle(
		catalog.filter((item) => needs.has(item.id) && !usedNeeded.has(item.id)),
		random,
	).slice(0, wanted);
	if (!needed.length) return null;

	const decoyPool = catalog.filter((item) => !needs.has(item.id));
	const chosen = new Set<string>();
	const decoys: ItemSummary[] = [];
	const take = (candidates: readonly ItemSummary[]) => {
		const options = candidates.filter((item) => !chosen.has(item.id));
		if (!options.length) return false;
		const pick = options[Math.floor(random() * options.length)];
		chosen.add(pick.id);
		decoys.push(pick);
		return true;
	};
	const tiers = [
		(target: ItemSummary) => decoyPool.filter((item) => item.categoryId === target.categoryId),
		(target: ItemSummary) => decoyPool.filter((item) => itemGroup(item) === itemGroup(target)),
		() => decoyPool,
	];
	// Round-robin over the needed items so every one of them gets look-alikes.
	for (let index = 0; decoys.length < total - needed.length && index < (total - needed.length) * tiers.length * 2; index += 1) {
		const target = needed[index % needed.length];
		for (const tier of tiers) if (take(tier(target))) break;
	}
	return { items: shuffle([...needed, ...decoys], random), needed: new Set(needed.map((item) => item.id)) };
}
