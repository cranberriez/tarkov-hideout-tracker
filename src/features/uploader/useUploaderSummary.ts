"use client";

import { useMemo } from "react";
import { useUserStore } from "@/lib/stores/useUserStore";
import type { ItemSummary } from "@/types/items";
import type { ReviewEntry } from "./review-model";
import { buildUploaderSummary, type KappaDemand } from "./summary-model";
import { unitSellValue } from "./decision-model";
import { inventoryBeforeSends, type SentCounts } from "./inventory-model";
import { useItemPrices } from "../items/useItemPrices";
import { useDemandRequirements } from "../items/demand/useDemandRequirements";

export function useUploaderSummary(
	entries: readonly ReviewEntry[],
	items: readonly ItemSummary[],
	sent: SentCounts,
	/** Items this scan already checked off on the Kappa checklist. */
	kappaSent: readonly string[],
) {
	const { mode, profile, kappa: savedKappa, query } = useDemandRequirements();
	const counts = useUserStore((state) => state.itemCounts);
	const priceIds = useMemo(() => entries.flatMap((entry) => (entry.itemId ? [entry.itemId] : [])), [entries]);
	const prices = useItemPrices(mode, priceIds);
	// This scan's own sends must not turn its kept copies into surplus.
	const owned = useMemo(() => inventoryBeforeSends(counts, sent), [counts, sent]);
	// Like inventory, this scan's own check-offs must not release the copies they reserved.
	const kappa = useMemo((): KappaDemand => {
		const completed = { ...savedKappa.completed };
		for (const itemId of kappaSent) delete completed[itemId];
		return { ...savedKappa, completed };
	}, [savedKappa, kappaSent]);
	const summary = useMemo(
		() =>
			query.data
				? buildUploaderSummary(
						entries,
						items,
						query.data,
						profile,
						owned,
						(id) => unitSellValue(prices.prices[id]),
						kappa,
					)
				: null,
		[entries, items, query.data, profile, owned, prices.prices, kappa],
	);
	return { summary, prices, error: query.error, retry: query.refetch, loading: query.isFetching };
}
