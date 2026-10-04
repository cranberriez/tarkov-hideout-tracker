/** A trader's buyback quote. Trader names and images come from the bundled list in lib/data/traders. */
export interface TraderSellOffer {
	traderId: string;
	currency?: string;
	price?: number;
	priceRUB: number;
}

export interface CurrentPrice {
	/** Robust minimum estimate; unstable estimates remain usable in calculations. */
	price?: number | null;
	referencePrice?: number | null;
	fleaStability?: FleaStability;
	fleaPriceReasons?: FleaPriceReason[];
	fleaSampleCount?: number;
	avg24hPrice?: number | null;
	high24hPrice?: number | null;
	low24hPrice?: number | null;
	lastLowPrice?: number | null;
	lastOfferCount?: number | null;
	changeLast48h?: number | null;
	changeLast48hPercent?: number | null;
	diff24h?: number | null;
	updatedAt?: number | null;
	sellFor?: TraderSellOffer[];
}

export interface PriceHistoryPoint {
	price: number;
	priceMin: number;
	offerCount: number | null;
	timestamp: number;
}

export type FleaStability = "stable" | "unstable" | "unavailable" | "reference";
export type FleaPriceReason =
	| "insufficient-history"
	| "sparse-offers"
	| "unknown-depth"
	| "divergent-reference"
	| "price-jump"
	| "volatile-minimum"
	| "no-offers"
	| "stale";

export interface StoredCurrentPrice {
	itemId: string;
	effectivePrice: number | null;
	latestPrice: number;
	latestPriceMin: number;
	latestOfferCount: number | null;
	latestPointTimestamp: number;
	sampleCount: number;
	totalOfferCount: number;
	lastCheckedAt: number;
	stability: FleaStability;
	reasons: FleaPriceReason[];
}
