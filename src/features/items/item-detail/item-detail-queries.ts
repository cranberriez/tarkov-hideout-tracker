import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { isPriceItemId } from "../../../lib/query/price-contract";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { gameDataKey } from "../../../lib/query/scope";
import { fetchJson, requireComplete } from "../../../lib/query/request";
import { isCompleteItemUsageData } from "../../../lib/utils/item-usage";
import type { ItemAcquisitionTreeData, ItemRelationsPayload, ItemUsageData } from "@/types/contracts";

const DETAIL_STALE_TIME = 60_000;
const DETAIL_GC_TIME = 5 * 60_000;
const DETAIL_QUERY_LIMIT = 60;
function scopedItemViewQueryOptions<T>({
	mode,
	itemId,
	domain,
	path,
	complete,
	partialMessage,
	onPricedPayload,
}: {
	mode: TarkovJsonGameMode;
	itemId: string;
	domain: "relations" | "usage" | "acquisition";
	path: string;
	complete: (payload: T) => boolean;
	partialMessage: string;
	/** When set, the request includes current prices and this receives the payload to seed price caches. */
	onPricedPayload?: (client: QueryClient, payload: T) => void;
}) {
	return queryOptions({
		queryKey: gameDataKey(mode, `item-detail-${domain}`, itemId, "unpriced-v1"),
		queryFn: async ({ signal, client }) => {
			const params = new URLSearchParams({ mode });
			if (!onPricedPayload) params.set("prices", "none");
			const payload = await fetchJson<T>(`/api/items/${encodeURIComponent(itemId)}/${path}?${params}`, { signal });
			requireComplete(payload, complete, partialMessage);
			onPricedPayload?.(client, payload);
			return payload;
		},
		staleTime: DETAIL_STALE_TIME,
		gcTime: DETAIL_GC_TIME,
		retry: false,
		meta: { retentionGroup: "item-detail", inactiveQueryLimit: DETAIL_QUERY_LIMIT },
	});
}

export function isCompleteItemRelations(payload: ItemRelationsPayload) {
	return Object.values(payload.errors).every((error) => error === null);
}

export function isCompleteItemAcquisition(payload: ItemAcquisitionTreeData) {
	return Object.values(payload.errors).every((error) => error === null);
}

export function itemRelationsQueryOptions(mode: TarkovJsonGameMode, itemId: string) {
	return scopedItemViewQueryOptions<ItemRelationsPayload>({
		mode,
		itemId,
		domain: "relations",
		path: "relations",
		complete: isCompleteItemRelations,
		partialMessage: "Some hideout or quest relations are unavailable.",
	});
}

export function itemUsageQueryOptions(mode: TarkovJsonGameMode, itemId: string) {
	return scopedItemViewQueryOptions<ItemUsageData>({
		mode,
		itemId,
		domain: "usage",
		path: "usage",
		complete: isCompleteItemUsageData,
		partialMessage: "Some trader or crafting data is unavailable.",
	});
}

/** Fills missing per-item price entries from a priced tree; absent prices are explicit nulls, as in the price transport. */
function seedItemPrices(mode: TarkovJsonGameMode, client: QueryClient, tree: ItemAcquisitionTreeData) {
	for (const item of tree.items) {
		if (!isPriceItemId(item.id)) continue;
		const key = gameDataKey(mode, "item-price", item.id);
		if (client.getQueryData(key) === undefined) client.setQueryData(key, item.marketPrice ?? null);
	}
}

/** `withPrices` fetches current prices in the same request and seeds the shared per-item price cache. */
export function itemAcquisitionQueryOptions(
	mode: TarkovJsonGameMode,
	itemId: string,
	{ withPrices = false }: { withPrices?: boolean } = {},
) {
	return scopedItemViewQueryOptions<ItemAcquisitionTreeData>({
		mode,
		itemId,
		domain: "acquisition",
		path: "acquisition-tree",
		complete: isCompleteItemAcquisition,
		partialMessage: "Some profit recommendation data is unavailable.",
		...(withPrices ? { onPricedPayload: (client, tree) => seedItemPrices(mode, client, tree) } : {}),
	});
}
