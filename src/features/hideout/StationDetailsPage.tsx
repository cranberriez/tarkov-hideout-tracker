"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, Clock } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { DataNotice } from "@/components/ui/data-notice";
import { DetailSection } from "@/components/ui/detail-section";
import { FilterRadioGroup } from "@/components/ui/filter-bar";
import { useDeferredPriceItems } from "@/features/items/DeferredPriceBoundary";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { useUserStore } from "@/lib/stores/useUserStore";
import { formatDuration } from "@/lib/utils/format-time";
import { poolItems } from "@/lib/utils/item-pooling";
import type { HideoutPageData } from "@/types/contracts";
import type { Station } from "@/types/hideout";
import { ExpandedItemRequirements } from "./components/ItemRequirementsExpanded";
import { NonItemRequirements } from "./components/NonItemRequirements";
import { StationCrafts } from "./components/StationCrafts";
import { StationIdentity, StationImage } from "./components/StationIdentity";
import { computeStationUpgradeStatus, defaultViewedLevel, getStationDependents, getStationLevel } from "./station-model";
import { stationHref } from "@/lib/entity-routes";

/**
 * `/hideout/stations/[stationId]`. The viewed level is local page state: browsing
 * requirements never changes the player's saved station level.
 */
export function StationDetailsPage({ station, data, mode }: { station: Station; data: HideoutPageData; mode: TarkovJsonGameMode }) {
    const stations = useMemo(() => data.stations ?? [station], [data.stations, station]);
    const items = useDeferredPriceItems(data.items);
    const itemById = useMemo(() => Object.fromEntries((items ?? []).map((item) => [item.id, item])), [items]);
    const store = useUserStore(useShallow((state) => ({
        stationLevels: state.stationLevels,
        hiddenStations: state.hiddenStations,
        showHidden: state.showHidden,
        checklistViewMode: state.checklistViewMode,
        completedRequirements: state.completedRequirements,
        toggleRequirement: state.toggleRequirement,
        itemCounts: state.itemCounts,
    })));
    const currentLevel = store.stationLevels[station.id] ?? 0;
    const maxLevel = station.levels.length;
    const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
    const viewedLevel = selectedLevel ?? defaultViewedLevel(station, currentLevel);
    const viewedLevelData = getStationLevel(station, viewedLevel);
    const pooledFirByItem = useMemo(() => Object.fromEntries(poolItems({
        stations,
        stationLevels: store.stationLevels,
        hiddenStations: store.hiddenStations,
        showHidden: store.showHidden,
        viewMode: store.checklistViewMode,
        completedRequirements: store.completedRequirements,
    }).map((item) => [item.id, item.firCount])), [stations, store.stationLevels, store.hiddenStations, store.showHidden, store.checklistViewMode, store.completedRequirements]);
    const upgradeStatus = computeStationUpgradeStatus({
        station,
        stations,
        stationLevels: store.stationLevels,
        itemById,
        itemCounts: store.itemCounts,
        pooledFirByItem,
    });
    const dependentGroups = useMemo(() => {
        const groups = new Map<string, { station: Station; entries: ReturnType<typeof getStationDependents> }>();
        for (const dependent of getStationDependents(stations, station)) {
            const group = groups.get(dependent.station.id) ?? { station: dependent.station, entries: [] };
            group.entries.push(dependent);
            groups.set(dependent.station.id, group);
        }
        return [...groups.values()];
    }, [station, stations]);
    const isMaxed = currentLevel >= maxLevel;
    const viewedState = viewedLevel == null
        ? null
        : viewedLevel <= currentLevel
          ? { label: "Built", tone: "success" as const }
          : viewedLevel === currentLevel + 1
            ? upgradeStatus === "ready"
                ? { label: "Ready to upgrade", tone: "success" as const }
                : upgradeStatus === "illegal"
                  ? { label: "Illegal state", tone: "danger" as const }
                  : { label: "Next upgrade", tone: "info" as const }
            : { label: "Future level", tone: "neutral" as const };
    const unresolvedViewedItems = viewedLevelData?.itemRequirements.filter((requirement) => !itemById[requirement.itemId]) ?? [];

    return (
        <main className="container mx-auto flex flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-subtle-foreground">
                <Link href="/hideout" className="transition-colors hover:text-foreground">Hideout</Link>
                <ChevronRight size={12} aria-hidden="true" />
                <span aria-current="page" className="truncate text-muted-foreground">{station.name}</span>
            </nav>

            <header className="flex flex-col gap-4 border-b border-border-color pb-5 sm:flex-row sm:items-center sm:justify-between">
                <StationIdentity station={station} currentLevel={currentLevel} maxLevel={maxLevel} headingLevel="h1" size="lg" />
                <div className="flex flex-wrap items-center gap-2">
                    {isMaxed
                        ? <Badge tone="success" size="md">Max level</Badge>
                        : upgradeStatus === "ready"
                          ? <Badge tone="success" size="md">Level {currentLevel + 1} ready</Badge>
                          : upgradeStatus === "illegal"
                            ? <Badge tone="danger" size="md">Illegal state</Badge>
                            : <Badge tone="info" size="md">Next: level {currentLevel + 1}</Badge>}
                    <Link href="/hideout" className={buttonClassName()}>Manage levels on Hideout</Link>
                </div>
            </header>

            {viewedLevel != null && maxLevel > 1 && (
                <div className="flex flex-wrap items-center gap-3">
                    <span id="station-level-label" className="text-[10px] font-bold uppercase tracking-wide text-subtle-foreground">View level</span>
                    <FilterRadioGroup
                        label={`${station.name} level to view`}
                        value={String(viewedLevel)}
                        onValueChange={(value) => setSelectedLevel(Number(value))}
                        options={station.levels.map((level) => ({ value: String(level.level), label: `Level ${level.level}` }))}
                        className="min-w-0 flex-1 sm:max-w-xl"
                    />
                </div>
            )}

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)]">
                <div className="flex min-w-0 flex-col gap-5">
                    {viewedLevelData ? (
                        <DetailSection
                            className="rounded-md border border-border-color"
                            title={`Level ${viewedLevelData.level} requirements`}
                            actions={
                                <div className="flex items-center gap-2">
                                    {viewedLevelData.constructionTime > 0 && (
                                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <Clock size={12} aria-hidden="true" />
                                            {formatDuration(viewedLevelData.constructionTime)}
                                        </span>
                                    )}
                                    {viewedState && <Badge tone={viewedState.tone}>{viewedState.label}</Badge>}
                                </div>
                            }
                            bodyClassName="flex flex-col gap-3"
                        >
                            <NonItemRequirements
                                station={station}
                                nextLevelData={viewedLevelData}
                                stations={stations}
                                stationLevels={store.stationLevels}
                            />
                            {unresolvedViewedItems.length > 0 && (
                                <DataNotice>
                                    {unresolvedViewedItems.length} required item{unresolvedViewedItems.length === 1 ? " is" : "s are"} missing from the catalog and cannot be shown.
                                </DataNotice>
                            )}
                            {viewedLevelData.itemRequirements.length > 0 ? (
                                <ExpandedItemRequirements
                                    nextLevelData={viewedLevelData}
                                    hideMoney={false}
                                    completedRequirements={store.completedRequirements}
                                    toggleRequirement={store.toggleRequirement}
                                    pooledFirByItem={pooledFirByItem}
                                    itemById={itemById}
                                />
                            ) : (
                                <DataNotice tone="empty">No item requirements for this level.</DataNotice>
                            )}
                        </DetailSection>
                    ) : (
                        <DataNotice tone="empty">This station has no upgrade levels.</DataNotice>
                    )}
                    <StationCrafts station={station} mode={mode} viewedLevel={viewedLevel} />
                </div>

                <aside className="flex flex-col gap-5">
                    <DetailSection className="rounded-md border border-border-color" title="Required by" description="Upgrades that need this station.">
                        {dependentGroups.length > 0 ? (
                            <ul className="flex flex-col gap-1.5">
                                {dependentGroups.map(({ station: dependent, entries }) => (
                                    <li key={dependent.id}>
                                        <Link
                                            href={stationHref(dependent.id)}
                                            className="flex items-start gap-2.5 rounded-sm p-1 text-sm transition-colors hover:bg-highlight/5 focus-visible:outline-2 focus-visible:outline-brand"
                                        >
                                            <StationImage station={dependent} size={28} />
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-foreground">{dependent.name}</span>
                                                <span className="mt-1 flex flex-wrap gap-1">
                                                    {entries.map((entry) => (
                                                        <Badge key={entry.level} size="xs" tone={currentLevel >= entry.requiresLevel ? "success" : "neutral"} title={`${dependent.name} level ${entry.level} needs ${station.name} level ${entry.requiresLevel}`}>
                                                            L{entry.level} · needs L{entry.requiresLevel}
                                                        </Badge>
                                                    ))}
                                                </span>
                                            </span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-xs text-subtle-foreground">No other station upgrade requires {station.name}.</p>
                        )}
                    </DetailSection>
                </aside>
            </div>
        </main>
    );
}
