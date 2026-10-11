import { normalizeCount, parseProgress, sumCosts, tiles, type Progress, type Tile } from "./battle-pass-model";

/** Stable seasonal document item IDs shared by inventory and document artwork. */
export const documentItemIds: Readonly<Record<string, string>> = {
	financial: "6a31807f17005505b70d5827",
	personnel: "6a317b9692cfdcddcb02a58e",
	project: "6a3181f178450ec91c0ea1aa",
	blueprints: "6a31824878450ec91c0ea1ae",
	test: "6a31828557705071410ca00e",
	user: "6a3182b72fd891345e047eef",
	medical: "6a3182dc6cd8de21cf0a3a7d",
	technical: "6a31830dde69ceafd805afa0",
};
export type PlayerItemCounts = Record<string, { have: number; haveFir: number }>;
export interface ItemCountChange {
	itemId: string;
	haveDelta: number;
	haveFirDelta: number;
}
export interface InventoryUpdate {
	progress: Progress;
	changes: ItemCountChange[];
}

/** The external-store writer is synchronous. Apply profile effects only after it returns. */
export function commitInventoryUpdate(
	write: (transform: (current: string | null) => string) => void,
	counts: PlayerItemCounts,
	prepare: (stored: Progress, counts: PlayerItemCounts) => InventoryUpdate,
	apply: (itemId: string, haveDelta: number, haveFirDelta: number) => void,
) {
	let changes: ItemCountChange[] = [];
	write((current) => {
		const prepared = prepare(parseProgress(current), counts);
		changes = prepared.changes;
		return JSON.stringify({ version: 1, ...prepared.progress });
	});
	for (const change of changes) apply(change.itemId, change.haveDelta, change.haveFirDelta);
}
const positiveCount = (value: number) => (Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0);

/** Ordinary stock belongs exclusively to the active profile; absent records mean zero. */
export function inventoryProgress(progress: Progress, itemCounts: PlayerItemCounts): Progress {
	const inventory = { ...progress.inventory };
	for (const [key, itemId] of Object.entries(documentItemIds)) {
		const counts = itemCounts[itemId] ?? { have: 0, haveFir: 0 };
		inventory[key] = positiveCount(counts.have) + positiveCount(counts.haveFir);
	}
	return { ...progress, inventory };
}

/** Adjust a displayed total while preserving FIR stock until non-FIR stock runs out. */
export function itemCountChange(itemId: string, counts: PlayerItemCounts[string], desired: number): ItemCountChange {
	const haveFir = positiveCount(counts.haveFir);
	const target = normalizeCount(desired);
	const nextFir = Math.min(haveFir, target);
	return { itemId, haveDelta: target - nextFir - counts.have, haveFirDelta: nextFir - counts.haveFir };
}

/** Keep mapped inventory edits in their existing profile owner, without copying them to the pass save. */
export function prepareInventoryUpdate(stored: Progress, next: Progress, itemCounts: PlayerItemCounts) {
	const inventory = { ...next.inventory };
	const changes: ItemCountChange[] = [];
	const current = inventoryProgress(stored, itemCounts);
	for (const [key, itemId] of Object.entries(documentItemIds)) {
		const counts = itemCounts[itemId] ?? { have: 0, haveFir: 0 };
		if (Object.hasOwn(next.inventory, key) && next.inventory[key] !== current.inventory[key])
			changes.push(itemCountChange(itemId, counts, next.inventory[key]));
		if (Object.hasOwn(stored.inventory, key)) inventory[key] = stored.inventory[key];
		else delete inventory[key];
	}
	return { progress: { ...next, inventory }, changes };
}

/** Only newly completed known rewards spend their actual ordinary document costs. */
export function completeInventoryTiles(
	stored: Progress,
	itemCounts: PlayerItemCounts,
	ids: string[],
	consume: boolean,
	knownTiles: Tile[] = tiles,
) {
	const completed = new Set(stored.completed);
	const requested = new Set(ids);
	const newlyCompleted = knownTiles.filter((tile) => requested.has(tile.id) && !completed.has(tile.id));
	const progress = {
		...stored,
		completed: [...new Set([...stored.completed, ...newlyCompleted.map((tile) => tile.id)])],
	};
	const changes: ItemCountChange[] = [];
	if (!consume) return { progress, changes };
	progress.inventory = { ...stored.inventory };
	for (const [key, amount] of Object.entries(sumCosts(newlyCompleted))) {
		const itemId = documentItemIds[key];
		const counts = itemId ? itemCounts[itemId] : undefined;
		if (counts) {
			const haveDelta = -Math.min(positiveCount(counts.have), amount) || 0;
			const haveFirDelta = -Math.min(positiveCount(counts.haveFir), Math.max(0, amount + haveDelta)) || 0;
			if (haveDelta || haveFirDelta) changes.push({ itemId, haveDelta, haveFirDelta });
		}
	}
	return { progress, changes };
}
