"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Clock } from "lucide-react";
import { ItemQuantityBadge, ItemThumbnail } from "@/components/entities/item-thumbnail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataNotice } from "@/components/ui/data-notice";
import { DetailSection } from "@/components/ui/detail-section";
import { itemHref } from "@/features/items/item-routes";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { isTrackedCraft } from "@/lib/price-calculation/craft-rules";
import { useGameDataEnabled } from "@/lib/query/game-data";
import { pageDataFromQuery, profitPageQueryOptions } from "@/lib/query/page-data";
import { formatDuration } from "@/lib/utils/format-time";
import type { Station } from "@/types/hideout";
import type { ItemSummary } from "@/types/items";
import type { ItemAmountRef } from "@/types/recipes";

/**
 * Crafts load on request through the shared unpriced recipe query (the same cache
 * the profit pages use), so opening a station page does not fetch the recipe graph.
 */
export function StationCrafts({ station, mode, viewedLevel }: { station: Station; mode: TarkovJsonGameMode; viewedLevel: number | null }) {
    const [requested, setRequested] = useState(false);
    const [allLevels, setAllLevels] = useState(false);
    const gameDataEnabled = useGameDataEnabled(mode);
    const query = useQuery({ ...profitPageQueryOptions(mode), enabled: requested && gameDataEnabled });
    const data = pageDataFromQuery(query.data, query.error, null);
    const itemById = useMemo(() => Object.fromEntries((data?.items ?? []).map((item) => [item.id, item])), [data?.items]);
    const crafts = useMemo(
        () => (data?.crafts ?? [])
            .filter((craft) => craft.stationId === station.id && isTrackedCraft(craft))
            .filter((craft) => allLevels || viewedLevel == null || craft.level === viewedLevel)
            .sort((a, b) => a.level - b.level || a.duration - b.duration),
        [allLevels, data?.crafts, station.id, viewedLevel],
    );

    return (
        <DetailSection
            className="rounded-md border border-border-color"
            title="Crafts"
            description={requested ? (allLevels ? "All levels." : `Unlocked at level ${viewedLevel}.`) : undefined}
            actions={requested && viewedLevel != null ? (
                <Button size="xs" selected={allLevels} aria-pressed={allLevels} onClick={() => setAllLevels((value) => !value)}>
                    All levels
                </Button>
            ) : undefined}
        >
            {!requested ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">Recipes are loaded on request.</p>
                    <Button size="sm" tone="brand" onClick={() => setRequested(true)}>Show crafts</Button>
                </div>
            ) : !data && (query.isPending || !gameDataEnabled) ? (
                <p role="status" className="text-xs text-muted-foreground">Loading crafts…</p>
            ) : !data || data.errors.crafts ? (
                <DataNotice action={<Button size="xs" onClick={() => void query.refetch()}>Retry</Button>}>
                    {data?.errors.crafts ?? "Craft data could not be loaded."}
                </DataNotice>
            ) : crafts.length === 0 ? (
                <DataNotice tone="empty">No crafts {allLevels ? "at this station" : "unlock at this level"}.</DataNotice>
            ) : (
                <ul className="flex flex-col divide-y divide-highlight/6">
                    {crafts.map((craft) => (
                        <li key={craft.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                                {craft.requiredItems.map((requirement) => (
                                    <CraftItem key={`${craft.id}-${requirement.itemId}`} amount={requirement} item={itemById[requirement.itemId]} />
                                ))}
                            </div>
                            <ArrowRight size={14} aria-hidden="true" className="text-subtle-foreground" />
                            <CraftItem amount={{ itemId: craft.productItemId, count: craft.productCount }} item={itemById[craft.productItemId]} showName />
                            <span className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
                                {allLevels && <Badge size="xs">L{craft.level}</Badge>}
                                {craft.taskUnlockId && <Badge size="xs" tone="warning">Quest unlock</Badge>}
                                <Clock size={11} aria-hidden="true" />
                                {formatDuration(craft.duration)}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </DetailSection>
    );
}

function CraftItem({ amount, item, showName = false }: { amount: ItemAmountRef; item: ItemSummary | undefined; showName?: boolean }) {
    const label = item?.name ?? "Unknown item";
    const content = (
        <>
            <ItemThumbnail item={item ?? { name: label }} size="sm" framed>
                {amount.count > 1 && <ItemQuantityBadge label={`×${amount.count}`} className="text-[10px]" />}
            </ItemThumbnail>
            {showName && <span className="max-w-48 truncate text-sm text-foreground">{label}</span>}
            {amount.isTool && <Badge size="xs">Tool</Badge>}
        </>
    );
    if (!item) return <span title={label} className="flex items-center gap-2">{content}</span>;
    return (
        <Link
            href={itemHref(item.id)}
            title={`${amount.count} × ${label}`}
            aria-label={showName ? undefined : `${amount.count} × ${label}`}
            className="flex items-center gap-2 rounded-sm transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-brand"
        >
            {content}
        </Link>
    );
}
