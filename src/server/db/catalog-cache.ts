import "server-only";

import type { DataResult, TarkovDataMode } from "@/types/common";
import type { Station } from "@/types/hideout";
import type { ItemSummary, TraderPurchaseOffer } from "@/types/items";
import type { FullQuest } from "@/types/quests";
import type { Trader } from "@/types/traders";
import { getPostgresDb } from "@/server/postgres/connection";
import {
	getAllCatalogItems,
	getCatalogItemsByIds,
	getQuests,
	getRecipes,
	getStations,
	getTraders,
} from "./domain-data";
import { getAllTraderOffers, getTraderOffersByIds } from "./price-data";
import { boundedReadCache, canonicalIds, evictMemoizedReads, mapBatches, memoizedRead } from "./read-cache";

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
const QUEST_MISS_BATCH_SIZE = 50;

interface QuestMissWaiter {
	resolve: (value: DataResult<FullQuest[]>) => void;
	reject: (reason: unknown) => void;
}

interface QuestMissQueue {
	mode: TarkovDataMode;
	version: string;
	waiters: Map<string, QuestMissWaiter[]>;
}

const questMissQueues = new Map<string, QuestMissQueue>();

async function flushQuestMisses(key: string, queue: QuestMissQueue): Promise<void> {
	// Detach before reading so misses arriving during I/O form the next bounded batch.
	if (questMissQueues.get(key) === queue) questMissQueues.delete(key);
	const ids = [...queue.waiters.keys()];
	try {
		for (let offset = 0; offset < ids.length; offset += QUEST_MISS_BATCH_SIZE) {
			const batch = ids.slice(offset, offset + QUEST_MISS_BATCH_SIZE);
			const result = await getQuests(queue.mode, getPostgresDb(), queue.version, batch);
			const byId = new Map(result.data.map((quest) => [quest.id, quest]));
			for (const id of batch) {
				const quest = byId.get(id);
				const value = { data: quest ? [quest] : [], updatedAt: result.updatedAt };
				for (const waiter of queue.waiters.get(id) ?? []) waiter.resolve(value);
			}
		}
	} catch (error) {
		for (const waiters of queue.waiters.values()) {
			for (const waiter of waiters) waiter.reject(error);
		}
	}
}

function coalescedQuestMiss(mode: TarkovDataMode, version: string, id: string): Promise<DataResult<FullQuest[]>> {
	const key = `${mode}\0${version}`;
	let queue = questMissQueues.get(key);
	if (!queue) {
		queue = { mode, version, waiters: new Map() };
		questMissQueues.set(key, queue);
		const pending = queue;
		setTimeout(() => void flushQuestMisses(key, pending), 0);
	}
	return new Promise((resolve, reject) => {
		const waiters = queue.waiters.get(id) ?? [];
		waiters.push({ resolve, reject });
		queue.waiters.set(id, waiters);
	});
}

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

/** Metadata-only quest source used by preparation and workspace relationship indexes. */
export function getCachedQuestIndexSource(mode: TarkovDataMode, version: string): Promise<DataResult<FullQuest[]>> {
	return versioned(mode, version, "quest-index-source-v1", () =>
		getQuests(mode, getPostgresDb(), version, undefined, "index"),
	);
}

/** Quest records selected by ID. Each entity has its own reusable versioned cache entry. */
export async function getCachedQuestsByIds(
	mode: TarkovDataMode,
	version: string,
	ids: readonly string[],
): Promise<DataResult<Record<string, FullQuest>>> {
	const canonical = canonicalIds(ids);
	if (canonical.length === 0) return { data: {}, updatedAt: 0 };
	const batches = await mapBatches(canonical, (batch) =>
		Promise.all(
			batch.map((id) => versioned(mode, version, `quest:${id}`, () => coalescedQuestMiss(mode, version, id))),
		),
	);
	const data = Object.create(null) as Record<string, FullQuest>;
	let updatedAt = 0;
	for (const batch of batches) {
		for (const result of batch) {
			updatedAt = Math.max(updatedAt, result.updatedAt);
			for (const quest of result.data) data[quest.id] = quest;
		}
	}
	return { data, updatedAt };
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

/** Catalog items for the requested IDs, optionally overlaid with current trader offers. */
export async function getCachedItemsByIds(
	mode: TarkovDataMode,
	version: string,
	ids: readonly string[],
	options: { includeOffers?: boolean } = {},
): Promise<DataResult<Record<string, ItemSummary>>> {
	const canonical = canonicalIds(ids);
	if (canonical.length === 0) return { data: {}, updatedAt: 0 };
	const batches = await mapBatches(canonical, async (batch) => {
		const key = JSON.stringify(batch);
		const catalog = versioned(mode, version, `items:${key}`, () =>
			getCatalogItemsByIds(mode, batch, getPostgresDb(), version),
		);
		if (options.includeOffers === false) return [await catalog, {} as Record<string, TraderPurchaseOffer[]>] as const;
		return Promise.all([
			catalog,
			memoizedRead(`offers:${mode}:${version}:${key}`, OFFERS_MEMO_MS, () =>
				boundedReadCache(
					["trader-offers", mode, version, key],
					() => getTraderOffersByIds(mode, batch),
					OFFERS_REVALIDATE_SECONDS,
				),
			),
		]) as Promise<readonly [DataResult<Record<string, ItemSummary>>, Record<string, TraderPurchaseOffer[]>]>;
	});
	const data = Object.create(null) as Record<string, ItemSummary>;
	let updatedAt = 0;
	for (const [catalog, offers] of batches) {
		updatedAt = Math.max(updatedAt, catalog.updatedAt);
		for (const [id, item] of Object.entries(catalog.data)) {
			const buyFromTrader = offers[id];
			data[id] = buyFromTrader?.length ? { ...item, buyFromTrader } : item;
		}
	}
	return { data, updatedAt };
}

/** Quests or traders selected by ID, preserving the catalog's name ordering. */
export function pickById<T extends { id: string }>(values: readonly T[], ids: readonly string[]): T[] {
	const wanted = new Set(ids);
	return values.filter((value) => wanted.has(value.id));
}
