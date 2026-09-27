import type { Metadata } from "next";
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

async function loadItem(itemId: string) {
	const gameMode = await getActiveTarkovJsonGameMode();
	return getItemDetailPageData(gameMode, itemId, await getCurrentPageRepository(gameMode));
}

export async function generateMetadata({ params }: ItemPageProps): Promise<Metadata> {
	const { item } = await loadItem(decodeRouteParam((await params).itemId));
	if (!item) return { title: "Item" };
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
	return <ItemDetailsPage item={item} />;
}
