import type { Metadata } from "next";
import { cache } from "react";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { notFound } from "next/navigation";
import { DataLoadError } from "@/components/core/DataLoadError";
import { ItemDetailsPage } from "@/features/items/item-detail/ItemDetailsPage";
import { itemPath } from "@/lib/entity-routes";
import { decodeRouteParam } from "@/lib/utils/route-param";
import { modeCanonical, readRouteGameMode } from "@/server/route-game-mode";
import { getItemDetailPageData } from "@/server/queries/getItemDetailPageData";
import { getCurrentPageRepository } from "@/server/queries/currentPageRepository";

interface ItemPageProps {
	params: Promise<{ mode: string; itemId: string }>;
}

export const revalidate = 7200;

/** Rendered on first visit, then cached per mode until revalidation (ISR). */
export function generateStaticParams() {
	return [];
}

// Shared by generateMetadata and the page within one render.
const loadItem = cache(async (gameMode: TarkovJsonGameMode, itemId: string) => {
	return getItemDetailPageData(gameMode, itemId, await getCurrentPageRepository(gameMode));
});

export async function generateMetadata({ params }: ItemPageProps): Promise<Metadata> {
	const { gameMode, dataMode } = await readRouteGameMode(params);
	const { item } = await loadItem(dataMode, decodeRouteParam((await params).itemId));
	if (!item) return { title: "Item unavailable", robots: { index: false, follow: true } };
	const label = item.shortName && item.shortName !== item.name ? `${item.name} (${item.shortName})` : item.name;
	return {
		title: label,
		description: `${label}${item.category ? `, ${item.category.name}` : ""}: Escape from Tarkov hideout and quest requirements, trader offers, crafts, and flea market prices.`,
		alternates: modeCanonical(gameMode, itemPath(item.id)),
	};
}

export default async function ItemPage({ params }: ItemPageProps) {
	const { dataMode: gameMode } = await readRouteGameMode(params);
	const { item, error } = await loadItem(gameMode, decodeRouteParam((await params).itemId));
	if (error) {
		return (
			<main className="container mx-auto px-6 py-8">
				<DataLoadError title="Item data is unavailable" messages={[error]} />
			</main>
		);
	}
	if (!item) notFound();
	return <ItemDetailsPage item={item} mode={gameMode} />;
}
