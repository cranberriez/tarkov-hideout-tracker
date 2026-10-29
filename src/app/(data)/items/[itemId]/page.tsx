import type { Metadata } from "next";
import { cache } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import {
	isCompleteItemAcquisition,
	isCompleteItemRelations,
	itemAcquisitionQueryOptions,
	itemRelationsQueryOptions,
	itemUsageQueryOptions,
} from "@/features/items/item-detail/item-detail-queries";
import type { InitialItemDetailViews } from "@/features/items/item-detail/useItemDetailRequestController";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { createQueryClient } from "@/lib/query/client";
import { isCompleteItemUsageData } from "@/lib/utils/item-usage";
import { getItemDetailViews, type ItemDetailViews } from "@/server/queries/getItemDetailViews";
import { notFound } from "next/navigation";
import { DataLoadError } from "@/components/core/DataLoadError";
import { ItemDetailsPage } from "@/features/items/item-detail/ItemDetailsPage";
import { itemHref } from "@/lib/entity-routes";
import { decodeRouteParam } from "@/lib/utils/route-param";
import { getActiveTarkovJsonGameMode } from "@/server/active-game-mode";
import { getItemDetailPageData } from "@/server/queries/getItemDetailPageData";
import { getCurrentPageRepository } from "@/server/queries/currentPageRepository";

interface ItemPageProps {
	params: Promise<{ itemId: string }>;
}

// Shared by generateMetadata and the page within one render.
const loadItem = cache(async (itemId: string) => {
	const gameMode = await getActiveTarkovJsonGameMode();
	return getItemDetailPageData(gameMode, itemId, await getCurrentPageRepository(gameMode));
});

export async function generateMetadata({ params }: ItemPageProps): Promise<Metadata> {
	const { item } = await loadItem(decodeRouteParam((await params).itemId));
	if (!item) return { title: "Item unavailable", robots: { index: false, follow: true } };
	const label = item.shortName && item.shortName !== item.name ? `${item.name} (${item.shortName})` : item.name;
	return {
		title: label,
		description: `${label}${item.category ? `, ${item.category.name}` : ""}: Escape from Tarkov hideout and quest requirements, trader offers, crafts, and flea market prices.`,
		alternates: { canonical: itemHref(item.id) },
	};
}

export default async function ItemPage({ params }: ItemPageProps) {
	const { item, error } = await loadItem(decodeRouteParam((await params).itemId));
	if (error) {
		return (
			<main className="container mx-auto px-6 py-8">
				<DataLoadError title="Item data is unavailable" messages={[error]} />
			</main>
		);
	}
	if (!item) notFound();
	const gameMode = await getActiveTarkovJsonGameMode();
	const views = await getItemDetailViews(gameMode, item.id, undefined, ["relations"]);
	const { state, initialViews } = dehydrateItemDetailViews(gameMode, item.id, views);
	return (
		<HydrationBoundary state={state}>
			<ItemDetailsPage item={item} mode={gameMode} initialViews={initialViews} />
		</HydrationBoundary>
	);
}

/**
 * Complete views enter the same mode-keyed cache the client queries use; partial views
 * are passed as retryable fallbacks, matching the client's partial-payload handling.
 */
function dehydrateItemDetailViews(mode: TarkovJsonGameMode, itemId: string, views: ItemDetailViews) {
	const client = createQueryClient({ gcTime: Infinity });
	const initialViews: InitialItemDetailViews = {};
	if (views.relations) {
		if (isCompleteItemRelations(views.relations))
			client.setQueryData(itemRelationsQueryOptions(mode, itemId).queryKey, views.relations);
		else initialViews.relations = views.relations;
	}
	if (views.usage) {
		if (isCompleteItemUsageData(views.usage))
			client.setQueryData(itemUsageQueryOptions(mode, itemId).queryKey, views.usage);
		else initialViews.usage = views.usage;
	}
	if (views.tree) {
		if (isCompleteItemAcquisition(views.tree))
			client.setQueryData(itemAcquisitionQueryOptions(mode, itemId).queryKey, views.tree);
		else initialViews.tree = views.tree;
	}
	const state = dehydrate(client);
	client.clear();
	return { state, initialViews };
}
