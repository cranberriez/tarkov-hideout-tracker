import type { TraderSellOffer } from "../../types/prices";

/*
 * Bundled trader identities, keyed by the stable tarkov.dev trader ID. Price payloads reference
 * traders by ID only. Every mode currently shares this list; add new traders here when they ship.
 */
export interface TraderInfo {
	id: string;
	name: string;
	normalizedName: string;
}

const TRADER_LIST: readonly TraderInfo[] = [
	{ id: "54cb50c76803fa8b248b4571", name: "Prapor", normalizedName: "prapor" },
	{ id: "54cb57776803fa99248b456e", name: "Therapist", normalizedName: "therapist" },
	{ id: "579dc571d53a0658a154fbec", name: "Fence", normalizedName: "fence" },
	{ id: "58330581ace78e27b8b10cee", name: "Skier", normalizedName: "skier" },
	{ id: "5935c25fb3acc3127c3d8cd9", name: "Peacekeeper", normalizedName: "peacekeeper" },
	{ id: "5a7c2eca46aef81a7ca2145d", name: "Mechanic", normalizedName: "mechanic" },
	{ id: "5ac3b934156ae10c4430e83c", name: "Ragman", normalizedName: "ragman" },
	{ id: "5c0647fdd443bc2504c2d371", name: "Jaeger", normalizedName: "jaeger" },
	{ id: "6617beeaa9cfa777ca915b7c", name: "Ref", normalizedName: "ref" },
	{ id: "638f541a29ffd1183d187f57", name: "Lightkeeper", normalizedName: "lightkeeper" },
	{ id: "656f0f98d80a697f855d34b1", name: "BTR Driver", normalizedName: "btr-driver" },
	{ id: "688246518448b05efd61d461", name: "Mr. Kerman", normalizedName: "mr-kerman" },
	{ id: "688246958448b05efd61d462", name: "Voevoda", normalizedName: "voevoda" },
	{ id: "68fe15910f29ba3fdbba9d54", name: "Taran", normalizedName: "taran" },
	{ id: "68fe15990f29ba3fdbba9d55", name: "Radio station", normalizedName: "radio-station" },
	{ id: "69e0d6cc77b63940375b9173", name: "Survivor", normalizedName: "survivor" },
];

const TRADERS = new Map(TRADER_LIST.map((trader) => [trader.id, trader]));

/** Unknown IDs (a trader added upstream before this list) get a neutral label rather than failing. */
export function traderInfo(id: string): TraderInfo {
	return TRADERS.get(id) ?? { id, name: "Unknown trader", normalizedName: id };
}

export function traderImageUrl(id: string): string {
	return `https://assets.tarkov.dev/${id}.webp`;
}

/**
 * Stored sell offers in either the current `{ traderId }` form or the earlier inline
 * `{ vendor: { id, ... } }` form. Entries without a trader ID are dropped.
 */
export function normalizeTraderSellOffers(value: unknown): TraderSellOffer[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((entry) => {
		if (!entry || typeof entry !== "object") return [];
		const { traderId, vendor, currency, price, priceRUB } = entry as {
			traderId?: unknown;
			vendor?: { id?: unknown };
			currency?: string;
			price?: number;
			priceRUB: number;
		};
		const id = typeof traderId === "string" ? traderId : vendor?.id;
		if (typeof id !== "string" || !id) return [];
		return [
			{
				traderId: id,
				...(currency !== undefined ? { currency } : {}),
				...(price !== undefined ? { price } : {}),
				priceRUB,
			},
		];
	});
}
