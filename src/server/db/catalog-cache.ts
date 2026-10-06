import "server-only";

import type { DataResult, TarkovDataMode } from "@/types/common";
import type { Station } from "@/types/hideout";
import type { ItemSummary, TraderPurchaseOffer } from "@/types/items";
import type { FullQuest } from "@/types/quests";
import type { Trader } from "@/types/traders";
import { getPostgresDb } from "@/server/postgres/connection";
import { getAllCatalogItems, getQuests, getRecipes, getStations, getTraders } from "./domain-data";
import { getAllTraderOffers } from "./price-data";
import { boundedReadCache, evictMemoizedReads, memoizedRead } from "./read-cache";

/*
 * Whole-domain catalog reads keyed by (mode, content version). A version's rows never change, so entries
 * are shared through the data cache and memoized per instance; reads that observe a newer version fail
 * their closing version check and are never stored. Values are shared between requests: treat as read-only.
 */
const VERSIONED_REVALIDATE_SECONDS = 7 * 24 * 60 * 60;
const VERSIONED_MEMO_MS = 24 * 60 * 60_000;
// Trader offers refresh independently of the catalog; at most ~6 minutes stale across both layers.
const OFFERS_REVALIDATE_SECONDS = 300;
const OFFERS_MEMO_MS = 60_000;

function deepFreeze<T>(value: T): T {
	if (value && typeof value === "object" && !Object.isFrozen(value)) {
		Object.freeze(value);
		for (const child of Object.values(value)) deepFreeze(child);
	}
	return value;
}

function versioned<T>(mode: TarkovDataMode, version: string, domain: string, load: () => Promise<T>): Promise<T> {
	const prefix = `catalog:${mode}:`;
	evictMemoizedReads((key) => key.startsWith(prefix) && !key.startsWith(`${prefix}${version}:`));
	return memoizedRead(`${prefix}${version}:${domain}`, VERSIONED_MEMO_MS, async () => {
		const value = await boundedReadCache(["catalog", domain, mode, version], load, VERSIONED_REVALIDATE_SECONDS, {
			compress: true,
		});
		// Surface accidental mutation of shared values during development and tests.
		return process.env.NODE_ENV === "production" ? value : deepFreeze(value);
	});
}

export function getCachedCatalogItems(mode: TarkovDataMode, version: string) {
	return versioned(mode, version, "items", () => getAllCatalogItems(mode, getPostgresDb(), version));
}
export function getCachedStations(mode: TarkovDataMode, version: string): Promise<DataResult<Station[]>> {
	return versioned(mode, version, "stations", () => getStations(mode, getPostgresDb(), version));
}
export function getCachedQuests(mode: TarkovDataMode, version: string): Promise<DataResult<FullQuest[]>> {
	return versioned(mode, version, "quests", () => getQuests(mode, getPostgresDb(), version));
}
export function getCachedTraders(mode: TarkovDataMode, version: string): Promise<DataResult<Trader[]>> {
	return versioned(mode, version, "traders", () => getTraders(mode, getPostgresDb(), version));
}
export function getCachedRecipes(mode: TarkovDataMode, version: string) {
	return versioned(mode, version, "recipes", () => getRecipes(mode, getPostgresDb(), version));
}

export function getCachedTraderOffers(mode: TarkovDataMode): Promise<Record<string, TraderPurchaseOffer[]>> {
	return memoizedRead(`offers:${mode}`, OFFERS_MEMO_MS, () =>
		boundedReadCache(["trader-offers", mode], () => getAllTraderOffers(mode), OFFERS_REVALIDATE_SECONDS, {
			compress: true,
		}),
	);
}

/** Catalog items for the requested IDs with current trader offers, matching `getItemsByIds`. */
export async function getCachedItemsByIds(
	mode: TarkovDataMode,
	version: string,
	ids: readonly string[],
): Promise<DataResult<Record<string, ItemSummary>>> {
	const [catalog, offers] = await Promise.all([getCachedCatalogItems(mode, version), getCachedTraderOffers(mode)]);
	const data = Object.create(null) as Record<string, ItemSummary>;
	for (const id of new Set(ids)) {
		const item = catalog.data[id];
		if (!item) continue;
		const buyFromTrader = offers[id];
		data[id] = buyFromTrader?.length ? { ...item, buyFromTrader } : item;
	}
	return { data, updatedAt: catalog.updatedAt };
}

/** Quests or traders selected by ID, preserving the catalog's name ordering. */
export function pickById<T extends { id: string }>(values: readonly T[], ids: readonly string[]): T[] {
	const wanted = new Set(ids);
	return values.filter((value) => wanted.has(value.id));
}
