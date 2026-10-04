import type { CurrentPrice } from "./prices";

export interface ItemIdentity {
	id: string;
	name: string;
	normalizedName: string;
}

export interface ItemCategory {
	id?: string;
	name: string;
	normalizedName: string;
}

/** A direct currency purchase offered by an in-game trader. */
export interface TraderPurchaseOffer {
	traderId: string;
	price: number;
	priceRUB: number;
	currency: string;
	currencyItemId: string;
	minTraderLevel: number;
	taskUnlockId?: string;
	restockAmount?: number | null;
	buyLimit?: number | null;
}

/** A standard item from the mode-specific Tarkov JSON item catalog. */
export interface ItemSummary extends ItemIdentity {
	/** First successful observation; null means an imported or unknown-date baseline. */
	firstSeenAt?: number | null;
	/** Release inferred from the editable timeline, or preserved imported provenance; not a verified introduction. */
	firstSeenPatch?: string;
	firstSeenReleaseId?: string;
	shortName?: string;
	iconLink?: string;
	gridImageLink?: string;
	image512pxLink?: string;
	baseImageLink?: string;
	link?: string;
	wikiLink?: string;
	minLevelForFlea?: number | null;
	onFleaMarket?: boolean;
	category?: ItemCategory;
	/** Resource capacity from the provider's resource properties (fuel tank units). */
	resourceUnits?: number;
	buyFromTrader?: TraderPurchaseOffer[];
	marketPrice?: CurrentPrice | null;
	/** Ephemeral delivery state; never persisted in player progress. */
	priceLoadState?: "pending" | "error" | "ready";
}
