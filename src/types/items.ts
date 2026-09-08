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
	/** First successful catalog publication; null means the pre-1.1.5 baseline. */
	firstSeenAt?: number | null;
	/** Patch being tracked when discovered, not a verified game introduction. */
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
	buyFromTrader?: TraderPurchaseOffer[];
	marketPrice?: CurrentPrice | null;
	/** Ephemeral delivery state; never persisted in player progress. */
	priceLoadState?: "pending" | "error" | "ready";
}
