import type { TarkovDataMode } from "@/types/common";
import type { PriceHistoryPoint } from "@/types/prices";
import type { CurrentPrice } from "@/types/prices";
import type { TraderPurchaseOffer } from "@/types/items";

export interface CatalogPriceRecord {
	itemId: string;
	marketPrice: CurrentPrice;
	/** Undefined means the provider omitted this observation; preserve the stored value. */
	traderPurchaseOffers?: TraderPurchaseOffer[];
}

export interface PriceSyncState {
	etag: string | null;
	latestPointTimestamp: number | null;
}

export type PriceRefreshOutcome =
	| {
			status: "updated";
			itemId: string;
			etag: string | null;
			checkedAt: number;
			points: PriceHistoryPoint[];
			effectivePrice: number | null;
			sampleCount: number;
			totalOfferCount: number;
	  }
	| {
			status: "not-modified";
			itemId: string;
			etag: string | null;
			checkedAt: number;
	  }
	| {
			status: "failed";
			itemId: string;
			checkedAt: number;
			error: string;
	  };

export interface PriceRefreshSummary {
	runId: string;
	mode: TarkovDataMode;
	status: "succeeded" | "partial" | "failed" | "skipped";
	eligibleCount: number;
	checkedCount: number;
	changedCount: number;
	notModifiedCount: number;
	failedCount: number;
	error?: string;
	catalogPriceStatus?: "updated" | "failed";
	catalogPriceError?: string;
}

export interface PriceRefreshStore {
	getEligibleItemIds(mode: TarkovDataMode): Promise<string[]>;
	getSyncStates(mode: TarkovDataMode): Promise<Record<string, PriceSyncState>>;
	tryAcquireLock(mode: TarkovDataMode, runId: string, lockedUntil: number, now: number): Promise<boolean>;
	renewLock(mode: TarkovDataMode, runId: string, lockedUntil: number, now: number): Promise<boolean>;
	releaseLock(mode: TarkovDataMode, runId: string): Promise<void>;
	startRun(runId: string, mode: TarkovDataMode, startedAt: number): Promise<void>;
	writeCatalogPrices(mode: TarkovDataMode, runId: string, records: CatalogPriceRecord[]): Promise<void>;
	writeOutcomes(mode: TarkovDataMode, runId: string, outcomes: PriceRefreshOutcome[]): Promise<void>;
	completeRun(runId: string, summary: PriceRefreshSummary, completedAt: number): Promise<void>;
}
