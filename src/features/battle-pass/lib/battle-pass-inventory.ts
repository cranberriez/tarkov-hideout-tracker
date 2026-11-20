import { normalizeCount } from "./battle-pass-model";

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
const positiveCount = (value: number) => (Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0);

/** One profile's ordinary document totals (non-FiR plus FiR); absent records mean zero. */
export function profileDocumentCounts(itemCounts: PlayerItemCounts, itemIds = documentItemIds) {
	const inventory: Record<string, number> = {};
	for (const [key, itemId] of Object.entries(itemIds)) {
		const counts = itemCounts[itemId] ?? { have: 0, haveFir: 0 };
		inventory[key] = positiveCount(counts.have) + positiveCount(counts.haveFir);
	}
	return inventory;
}

/** Adjust a displayed total while preserving FIR stock until non-FIR stock runs out. */
export function itemCountChange(itemId: string, counts: PlayerItemCounts[string], desired: number): ItemCountChange {
	const haveFir = positiveCount(counts.haveFir);
	const target = normalizeCount(desired);
	const nextFir = Math.min(haveFir, target);
	return { itemId, haveDelta: target - nextFir - counts.have, haveFirDelta: nextFir - counts.haveFir };
}
