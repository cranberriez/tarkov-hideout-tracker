"use client";

import { useCallback, useMemo } from "react";
import { useItemPrices } from "@/features/items/useItemPrices";
import { useSearchManifest } from "@/lib/search/useSearchManifest";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import type { CurrentPrice } from "@/types/prices";
import type { MapMarker } from "../tarkov-map";

export type MapItem = { name: string; value: number };
export type MapItemGet = (id: string) => MapItem | undefined;

/** What an item is worth in roubles: its flea estimate, 24h average, last low, then best trader offer. */
export function itemValue(price: CurrentPrice | null | undefined): number {
	if (!price) return 0;
	const trader = Math.max(0, ...(price.sellFor ?? []).map((offer) => offer.priceRUB));
	const value = [price.price, price.avg24hPrice, price.lastLowPrice, trader].find(
		(candidate) => typeof candidate === "number" && candidate > 0,
	);
	return value ?? 0;
}

/** Item ids a map's loose loot spawns may hold. */
export function looseItemIds(markers: readonly MapMarker[]): string[] {
	const ids = new Set<string>();
	for (const marker of markers) {
		if (marker.layer !== "loose") continue;
		for (const row of marker.details ?? []) for (const item of row.items ?? []) ids.add(item.id);
	}
	return [...ids];
}

/** The most valuable possible item of each loose loot marker, by marker id; markers with no priced item are left out. */
export function bestLooseItems(markers: readonly MapMarker[], get: MapItemGet): Map<string, string> {
	const best = new Map<string, string>();
	for (const marker of markers) {
		if (marker.layer !== "loose") continue;
		let top = 0;
		let topId: string | undefined;
		for (const { id } of marker.details?.find((row) => row.label === "Possible items")?.items ?? []) {
			const value = get(id)?.value ?? 0;
			if (value > top) {
				top = value;
				topId = id;
			}
		}
		if (topId) best.set(marker.id, topId);
	}
	return best;
}

/**
 * Item names from the shared search manifest, and current values for `priced` ids (requested only while a
 * consumer needs them, so the map loads no prices by default).
 */
export function useMapItems(mode: TarkovJsonGameMode, priced: readonly string[]) {
	const manifest = useSearchManifest(mode, true);
	const names = useMemo(
		() => new Map((manifest.data?.items ?? []).map((item) => [item.id, item.name] as const)),
		[manifest.data],
	);
	const prices = useItemPrices(mode, priced);
	const get = useCallback<MapItemGet>(
		(id) => {
			const name = names.get(id);
			const value = itemValue(prices.prices[id]);
			return name || value ? { name: name ?? id, value } : undefined;
		},
		[names, prices.prices],
	);
	return { get, pricesState: priced.length ? prices.state : "ready" };
}
