"use client";

import { useMemo, type ComponentProps, type ReactNode } from "react";
import { useItemPrices } from "@/features/items/useItemPrices";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { itemRelationsQueryOptions } from "@/features/items/item-detail/item-detail-queries";
import { getBestTraderOffer } from "@/lib/price-calculation/prices";
import { Badge } from "@/components/ui/badge";
import { preloadHoverImage } from "@/components/ui/hover-preview-provider";
import { toTarkovJsonGameMode } from "@/lib/game-mode";
import { gameDataKey } from "@/lib/query/scope";
import { useUIStore } from "@/lib/stores/useUIStore";
import { useUserStore } from "@/lib/stores/useUserStore";
import { describeFleaPrice, formatFleaPriceState, formatRoubles } from "@/lib/utils/market-price";
import { cn } from "@/lib/utils";
import type { ItemSummary } from "@/types/items";
import type { CurrentPrice } from "@/types/prices";
import { EntityPreview, PreviewFact } from "./entity-preview";
import { ItemThumbnail } from "./item-thumbnail";
import { PriceChange } from "./price-change";
import { ItemPreviewNeeds } from "./item-preview-needs";
import { itemImageUrl } from "@/lib/utils/item-images";
import { traderImageUrl, traderInfo } from "@/lib/data/traders";

export type PreviewItem = Pick<ItemSummary, "id" | "name"> &
	Partial<
		Pick<
			ItemSummary,
			| "shortName"
			| "iconLink"
			| "gridImageLink"
			| "image512pxLink"
			| "category"
			| "marketPrice"
			| "priceLoadState"
			| "normalizedName"
			| "onFleaMarket"
		>
	>;

type ButtonProps = Omit<ComponentProps<"button">, "children" | "type">;

/** Summary accepted by the item dialog; partial link data is completed by its relations request. */
export function toItemSummary(item: PreviewItem): ItemSummary {
	return { normalizedName: item.normalizedName ?? item.id, ...item };
}

/**
 * Opens the global item-detail dialog, with a hover/focus preview. The preview uses
 * supplied summary data, saved inventory, and already-cached prices. The visible
 * card loads only unpriced requirements through the shared relations cache.
 */
export function ItemLink({
	item,
	children,
	preview = true,
	previewDetails,
	className,
	onClick,
	...props
}: ButtonProps & {
	item: PreviewItem;
	children?: ReactNode;
	preview?: boolean;
	/** Consumer-supplied context, for example demand or FiR counts. */
	previewDetails?: ReactNode;
}) {
	const openItemDetail = useUIStore((state) => state.openItemDetail);
	const previewImage = itemImageUrl(item, "512");
	return (
		<EntityPreview
			disabled={!preview}
			prepare={() => preloadHoverImage(previewImage)}
			renderPreview={() => <ItemPreviewCard item={item} details={previewDetails} />}
		>
			{(triggerProps) => (
				<button
					{...props}
					{...triggerProps}
					type="button"
					aria-haspopup="dialog"
					onClick={(event) => {
						onClick?.(event);
						if (!event.defaultPrevented) openItemDetail(toItemSummary(item));
					}}
					className={cn("cursor-pointer text-left", className)}
				>
					{children ?? item.name}
				</button>
			)}
		</EntityPreview>
	);
}

function ItemPreviewCard({ item, details }: { item: PreviewItem; details?: ReactNode }) {
	const client = useQueryClient();
	const mode = toTarkovJsonGameMode(useUserStore((state) => state.gameMode));
	const owned = useUserStore((state) => state.itemCounts[item.id]);
	const inventoryCount = (owned?.have ?? 0) + (owned?.haveFir ?? 0);
	// Observe metadata loaded by the demand row; this observer starts no request.
	const relations = useQuery({ ...itemRelationsQueryOptions(mode, item.id), enabled: false });
	const fleaBanned = (item.onFleaMarket ?? relations.data?.item?.onFleaMarket) === false;
	const traderPriceIds = useMemo(
		() => (fleaBanned && !item.marketPrice ? [item.id] : []),
		[fleaBanned, item.id, item.marketPrice],
	);
	const traderPrices = useItemPrices(mode, traderPriceIds);
	const cachedPrice =
		item.marketPrice ??
		traderPrices.prices[item.id] ??
		client.getQueryData<CurrentPrice | null>(gameDataKey(mode, "item-price", item.id));
	const priceState = describeFleaPrice({ marketPrice: cachedPrice, priceLoadState: item.priceLoadState });
	const bestTrader = fleaBanned ? getBestTraderOffer({ ...toItemSummary(item), marketPrice: cachedPrice }) : null;
	const isCurrency =
		item.normalizedName === "roubles" || item.normalizedName === "dollars" || item.normalizedName === "euros";
	const category = item.category && item.category.normalizedName !== "item" ? item.category.name : null;

	return (
		<div>
			<div className="flex items-center gap-2">
				<ItemThumbnail item={{ ...item, iconLink: itemImageUrl(item, "512") }} size={40} framed />
				<div className="min-w-0">
					{category && <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand">{category}</p>}
					<p className="text-[13px] font-semibold leading-snug text-foreground">{item.name}</p>
				</div>
			</div>
			<div className="mt-2 space-y-1">
				{!isCurrency && inventoryCount !== 0 && (
					<PreviewFact label="In inventory">
						<span className="font-mono">{inventoryCount}</span>
						{(owned?.haveFir ?? 0) > 0 && (
							<Badge tone="fir" size="xs" className="ml-1.5">
								{owned?.haveFir} FiR
							</Badge>
						)}
					</PreviewFact>
				)}
				{!isCurrency && !fleaBanned && priceState.kind !== "missing" && (
					<PreviewFact label="Flea estimate">
						<span
							className={`inline-flex flex-wrap items-center gap-1 ${priceState.kind === "price" ? "font-mono" : "text-muted-foreground"}`}
						>
							{formatFleaPriceState(priceState)}
							{priceState.kind === "price" && cachedPrice?.changeLast48hPercent != null && (
								<PriceChange value={cachedPrice.changeLast48hPercent} compact />
							)}
						</span>
					</PreviewFact>
				)}
				{!isCurrency && fleaBanned && bestTrader && bestTrader.priceRUB > 0 && (
					<PreviewFact label="Trader sell">
						<span className="inline-flex items-center gap-1">
							<Image
								src={traderImageUrl(bestTrader.traderId)}
								alt=""
								width={16}
								height={16}
								className="size-4 shrink-0 rounded-full object-cover"
								unoptimized
							/>
							<span className="font-mono">{formatRoubles(bestTrader.priceRUB)}</span>
						</span>
						<span className="block text-[11px] text-muted-foreground">{traderInfo(bestTrader.traderId).name}</span>
					</PreviewFact>
				)}
				{!isCurrency && fleaBanned && !bestTrader && (
					<PreviewFact label="Trader sell">
						<span className="text-muted-foreground">
							{traderPrices.states[item.id] === "pending" ? "Loading…" : "Unavailable"}
						</span>
					</PreviewFact>
				)}
				{!fleaBanned && priceState.kind === "price" && priceState.unstable && (
					<PreviewFact label="Price status">
						<span className="text-warning">Unstable</span>
					</PreviewFact>
				)}
				{!isCurrency && <ItemPreviewNeeds itemId={item.id} />}
				{details}
			</div>
		</div>
	);
}
