"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Check } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useDataContext } from "@/app/(data)/_dataContext";
import { DataLoadError } from "@/components/core/DataLoadError";
import { ItemDetailModal } from "@/features/items/item-detail/ItemDetailModal";
import type {
    QuestAnyOfGroupEntry,
    QuestItemIndexEntry,
    QuestRewardIndexEntry,
} from "@/lib/utils/quest-item-index";
import type { QuestAvailabilityQuest } from "@/lib/utils/quest-availability";
import { useKappaStore, type KappaViewMode } from "@/lib/stores/useKappaStore";
import { useUserStore } from "@/lib/stores/useUserStore";
import type { GlobalItem, ItemDetails } from "@/types";

interface KappaChecklistClientPageProps {
    collectorQuest: {
        id: string;
        name: string;
        traderImageLink?: string | null;
        traderImage4xLink?: string | null;
    } | null;
    collectorItemIds: string[];
    questItemIndex: QuestItemIndexEntry[];
    questRewardIndex: QuestRewardIndexEntry[];
    questAnyOfGroups: QuestAnyOfGroupEntry[];
    questAvailabilityQuests: QuestAvailabilityQuest[];
}

const VIEW_OPTIONS: Array<{ value: KappaViewMode; label: string }> = [
    { value: "all", label: "All" },
    { value: "need", label: "Need" },
];

export function KappaChecklistClientPage({
    collectorQuest,
    collectorItemIds,
    questItemIndex,
    questRewardIndex,
    questAnyOfGroups,
    questAvailabilityQuests,
}: KappaChecklistClientPageProps) {
    const { stations, stationsError, items, itemsError, itemById } = useDataContext();
    const [selectedItem, setSelectedItem] = useState<ItemDetails | null>(null);
    const { stationLevels, hiddenStations, completedRequirements, gameMode } = useUserStore(
        useShallow((state) => ({
            stationLevels: state.stationLevels,
            hiddenStations: state.hiddenStations,
            completedRequirements: state.completedRequirements,
            gameMode: state.gameMode,
        })),
    );
    const { completedItemsByMode, viewMode, setViewMode, toggleCompletedItem } =
        useKappaStore(
            useShallow((state) => ({
                completedItemsByMode: state.completedItemsByMode,
                viewMode: state.viewMode,
                setViewMode: state.setViewMode,
                toggleCompletedItem: state.toggleCompletedItem,
            })),
        );
    const completedItems = useMemo(
        () => completedItemsByMode[gameMode] ?? {},
        [completedItemsByMode, gameMode],
    );

    const collectorItems = useMemo(
        () =>
            collectorItemIds
                .map((itemId) => itemById[itemId])
                .filter((item): item is GlobalItem => item !== undefined)
                .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
        [collectorItemIds, itemById],
    );
    const visibleItems = useMemo(
        () =>
            viewMode === "need"
                ? collectorItems.filter((item) => !completedItems[item.id])
                : collectorItems,
        [collectorItems, completedItems, viewMode],
    );
    const completedCount = collectorItems.reduce(
        (count, item) => count + (completedItems[item.id] ? 1 : 0),
        0,
    );

    const errorMessages = [
        ...(stationsError ? [stationsError] : []),
        ...(itemsError ? [itemsError] : []),
        ...(!collectorQuest
            ? ["The Collector quest could not be found for this game mode."]
            : []),
        ...(collectorQuest && collectorItemIds.length === 0
            ? ["The Collector quest does not currently include any required items."]
            : []),
        ...(collectorItemIds.length > 0 && collectorItems.length === 0
            ? ["Collector items could not be matched to the item catalog."]
            : []),
    ];

    return (
        <main className="container mx-auto px-6 py-8">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">
                        KAPPA REQUIRED ITEMS
                    </h1>
                    <p className="mt-1 text-sm text-gray-400">
                        {completedCount} of {collectorItems.length} collected
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
                    {collectorQuest && (
                        <Link
                            href={`/quests#quest-${collectorQuest.id}`}
                            aria-label="Open Collector quest"
                            className="inline-flex h-[46px] items-center gap-2 rounded-md border border-white/10 bg-black/30 px-3 text-sm font-semibold text-gray-200 transition-colors hover:border-amber-400/40 hover:bg-amber-400/5 hover:text-white"
                        >
                            {collectorQuest.traderImageLink ? (
                                <img
                                    src={
                                        collectorQuest.traderImage4xLink ??
                                        collectorQuest.traderImageLink
                                    }
                                    alt="Fence"
                                    className="size-7 rounded-full object-cover"
                                />
                            ) : null}
                            <span>{collectorQuest.name}</span>
                        </Link>
                    )}

                    <div
                        className="inline-flex rounded-md border border-white/10 bg-black/30 p-1"
                        aria-label="Kappa item filter"
                    >
                        {VIEW_OPTIONS.map((option) => {
                            const active = viewMode === option.value;
                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setViewMode(option.value)}
                                    aria-pressed={active}
                                    className={`min-w-20 rounded px-4 py-2 text-sm font-semibold transition-colors ${
                                        active
                                            ? "bg-tarkov-green text-black"
                                            : "text-gray-400 hover:bg-white/5 hover:text-white"
                                    }`}
                                >
                                    {option.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {errorMessages.length > 0 || !stations || !items ? (
                <DataLoadError
                    title="Kappa checklist data is unavailable"
                    messages={[
                        ...errorMessages,
                        ...(!stations && !stationsError
                            ? ["Hideout station data could not be loaded."]
                            : []),
                        ...(!items && !itemsError
                            ? ["Item catalog data could not be loaded."]
                            : []),
                    ]}
                />
            ) : visibleItems.length === 0 ? (
                <div className="rounded-lg border border-tarkov-green/20 bg-tarkov-green/5 px-5 py-10 text-center text-sm text-gray-300">
                    You have collected every Kappa item.
                </div>
            ) : (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10">
                    {visibleItems.map((item) => {
                        const isCompleted = !!completedItems[item.id];
                        return (
                            <li
                                key={item.id}
                                className={`flex min-w-0 overflow-hidden rounded-md border bg-card transition-colors ${
                                    isCompleted ? "border-tarkov-green/40" : "border-white/10"
                                }`}
                            >
                                <button
                                    type="button"
                                    onClick={() => setSelectedItem(item)}
                                    className="group relative aspect-square min-w-0 flex-1 overflow-hidden bg-black/35 transition-colors hover:bg-black/55 focus-visible:z-10"
                                    title={`Open ${item.name} details`}
                                    aria-label={`Open ${item.name} details`}
                                >
                                    {item.iconLink || item.gridImageLink ? (
                                        <span className="absolute -inset-[3px] flex items-center justify-center overflow-hidden">
                                            <img
                                                src={item.iconLink ?? item.gridImageLink}
                                                alt=""
                                                className={`h-full w-full object-contain transition-opacity ${
                                                    isCompleted
                                                        ? "opacity-45"
                                                        : "group-hover:opacity-90"
                                                }`}
                                            />
                                        </span>
                                    ) : (
                                        <span className="flex h-full items-center justify-center text-xl text-gray-600">
                                            ?
                                        </span>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => toggleCompletedItem(gameMode, item.id)}
                                    aria-pressed={isCompleted}
                                    aria-label={`${isCompleted ? "Mark as needed" : "Mark as collected"}: ${item.name}`}
                                    title={`${isCompleted ? "Mark as needed" : "Mark as collected"}: ${item.name}`}
                                    className={`flex w-10 shrink-0 items-center justify-center border-l transition-colors ${
                                        isCompleted
                                            ? "border-tarkov-green/30 bg-tarkov-green/15 text-tarkov-green hover:bg-tarkov-green/25"
                                            : "border-white/10 text-gray-500 hover:bg-white/5 hover:text-gray-200"
                                    }`}
                                >
                                    <Check aria-hidden="true" className="size-5" strokeWidth={2.5} />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}

            <p className="mt-6 flex items-center gap-2 text-sm text-orange-300/90">
                <BadgeCheck aria-hidden="true" className="size-4 shrink-0" />
                All Collector items must be found in raid.
            </p>

            {selectedItem && (
                <ItemDetailModal
                    item={selectedItem}
                    isOpen
                    onClose={() => setSelectedItem(null)}
                    stations={stations}
                    stationLevels={stationLevels}
                    hiddenStations={hiddenStations}
                    completedRequirements={completedRequirements}
                    questItemIndex={questItemIndex}
                    questRewardIndex={questRewardIndex}
                    questAnyOfGroups={questAnyOfGroups}
                    questAvailabilityQuests={questAvailabilityQuests}
                />
            )}
        </main>
    );
}
