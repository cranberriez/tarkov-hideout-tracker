"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { itemHref } from "@/lib/entity-routes";
import { toTarkovJsonGameMode } from "@/lib/game-mode";
import { gameDataKey } from "@/lib/query/scope";
import { useUserStore } from "@/lib/stores/useUserStore";
import { describeFleaPrice, formatFleaPriceState } from "@/lib/utils/market-price";
import { cn } from "@/lib/utils";
import type { ItemSummary } from "@/types/items";
import type { CurrentPrice } from "@/types/prices";
import { EntityPreview, PreviewFact, PreviewFooter } from "./entity-preview";
import { ItemThumbnail } from "./item-thumbnail";

export type PreviewItem = Pick<ItemSummary, "id" | "name"> & Partial<Pick<ItemSummary,
    "shortName" | "iconLink" | "gridImageLink" | "image512pxLink" | "category" | "marketPrice" | "priceLoadState" | "normalizedName"
>>;

type LinkProps = Omit<ComponentProps<typeof Link>, "href" | "children">;

/**
 * Link to `/items/[itemId]` with a hover/focus preview. The preview uses supplied
 * summary data, saved inventory, and already-cached prices only; it never starts
 * the item-detail request pipeline.
 */
export function ItemLink({
    item,
    children,
    preview = true,
    previewDetails,
    className,
    ...props
}: LinkProps & {
    item: PreviewItem;
    children?: ReactNode;
    preview?: boolean;
    /** Consumer-supplied context, for example demand or FiR counts. */
    previewDetails?: ReactNode;
}) {
    return (
        <EntityPreview disabled={!preview} renderPreview={() => <ItemPreviewCard item={item} details={previewDetails} />}>
            {(triggerProps) => (
                <Link {...props} {...triggerProps} href={itemHref(item.id)} className={cn(className)}>
                    {children ?? item.name}
                </Link>
            )}
        </EntityPreview>
    );
}

function ItemPreviewCard({ item, details }: { item: PreviewItem; details?: ReactNode }) {
    const client = useQueryClient();
    const mode = toTarkovJsonGameMode(useUserStore((state) => state.gameMode));
    const owned = useUserStore((state) => state.itemCounts[item.id]);
    const cachedPrice = item.marketPrice ?? client.getQueryData<CurrentPrice | null>(gameDataKey(mode, "item-price", item.id));
    const priceState = describeFleaPrice({ marketPrice: cachedPrice, priceLoadState: item.priceLoadState });
    const isCurrency = item.normalizedName === "roubles" || item.normalizedName === "dollars" || item.normalizedName === "euros";
    const category = item.category && item.category.normalizedName !== "item" ? item.category.name : null;

    return (
        <div>
            <div className="flex items-center gap-3">
                <ItemThumbnail item={{ ...item, iconLink: item.gridImageLink ?? item.iconLink }} size="lg" framed />
                <div className="min-w-0">
                    {category && <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand">{category}</p>}
                    <p className="text-sm font-semibold leading-snug text-foreground">{item.name}</p>
                    {item.shortName && item.shortName !== item.name && <p className="text-xs text-muted-foreground">{item.shortName}</p>}
                </div>
            </div>
            <div className="mt-3 space-y-1.5">
                {!isCurrency && (
                    <PreviewFact label="In inventory">
                        <span className="font-mono">{owned?.have ?? 0}</span>
                        {(owned?.haveFir ?? 0) > 0 && <Badge tone="warning" size="xs" className="ml-1.5">{owned?.haveFir} FiR</Badge>}
                    </PreviewFact>
                )}
                {!isCurrency && priceState.kind !== "missing" && (
                    <PreviewFact label="Flea estimate">
                        <span className={priceState.kind === "price" ? "font-mono" : "text-subtle-foreground"}>{formatFleaPriceState(priceState)}</span>
                    </PreviewFact>
                )}
                {details}
            </div>
            <PreviewFooter>Open item page for requirements, trades, and crafts</PreviewFooter>
        </div>
    );
}
