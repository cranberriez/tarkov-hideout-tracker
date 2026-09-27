"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { stationHref } from "@/lib/entity-routes";
import { toTarkovJsonGameMode } from "@/lib/game-mode";
import { hideoutPageQueryOptions } from "@/lib/query/page-data";
import { useUserStore } from "@/lib/stores/useUserStore";
import { formatDuration } from "@/lib/utils/format-time";
import type { HideoutPageData } from "@/types/contracts";
import type { Station } from "@/types/hideout";
import { EntityPreview, PreviewFact, PreviewFooter } from "./entity-preview";
import { StationImage } from "./station-image";

type LinkProps = Omit<ComponentProps<typeof Link>, "href" | "children">;

/**
 * Link to `/hideout/stations/[stationId]` with a hover/focus preview built from the
 * supplied station or the cached Hideout payload, plus the saved station level.
 */
export function StationLink({
    station,
    children,
    preview = true,
    className,
    ...props
}: LinkProps & {
    station: Pick<Station, "id" | "name"> & Partial<Station>;
    children?: ReactNode;
    preview?: boolean;
}) {
    return (
        <EntityPreview disabled={!preview} renderPreview={() => <StationPreviewCard station={station} />}>
            {(triggerProps) => (
                <Link {...props} {...triggerProps} href={stationHref(station.id)} className={className}>
                    {children ?? station.name}
                </Link>
            )}
        </EntityPreview>
    );
}

function StationPreviewCard({ station: supplied }: { station: Pick<Station, "id" | "name"> & Partial<Station> }) {
    const client = useQueryClient();
    const mode = toTarkovJsonGameMode(useUserStore((state) => state.gameMode));
    const currentLevel = useUserStore((state) => state.stationLevels[supplied.id] ?? 0);
    const cached = supplied.levels
        ? null
        : client.getQueryData<HideoutPageData>(hideoutPageQueryOptions(mode).queryKey)?.stations?.find((entry) => entry.id === supplied.id);
    const station = { ...cached, ...supplied, levels: supplied.levels ?? cached?.levels };
    const maxLevel = station.levels?.length ?? null;
    const next = station.levels?.find((level) => level.level === currentLevel + 1) ?? null;

    return (
        <div>
            <div className="flex items-center gap-3">
                <StationImage station={{ name: station.name, normalizedName: station.normalizedName ?? station.id, imageLink: station.imageLink }} size={44} />
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{station.name}</p>
                    <p className="font-mono text-[11px] text-subtle-foreground">
                        Your level <span className={currentLevel > 0 ? "text-brand" : undefined}>{currentLevel}</span>
                        {maxLevel != null && ` / ${maxLevel}`}
                    </p>
                </div>
            </div>
            {maxLevel != null && (
                <div className="mt-3 space-y-1.5">
                    {next ? (
                        <>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-subtle-foreground">Next: level {next.level}</p>
                            <PreviewFact label="Items">{next.itemRequirements.length}</PreviewFact>
                            {next.stationLevelRequirements.length > 0 && (
                                <PreviewFact label="Stations">{next.stationLevelRequirements.length}</PreviewFact>
                            )}
                            {next.constructionTime > 0 && <PreviewFact label="Build time">{formatDuration(next.constructionTime)}</PreviewFact>}
                        </>
                    ) : (
                        <Badge tone="success" size="xs">Max level</Badge>
                    )}
                </div>
            )}
            <PreviewFooter>Open station for every level and its crafts</PreviewFooter>
        </div>
    );
}
