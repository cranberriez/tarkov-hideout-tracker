"use client";

import { useDeferredPriceItems } from "@/features/items/DeferredPriceBoundary";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Check } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { DataLoadError } from "@/components/core/DataLoadError";
import { ItemDetailModal } from "@/features/items/item-detail/LazyItemDetailModal";
import { useKappaStore, type KappaViewMode } from "@/lib/stores/useKappaStore";
import { useUserStore } from "@/lib/stores/useUserStore";
import type { ItemSummary } from "@/types/items";
import type { KappaChecklistPageData } from "@/types/contracts";

interface KappaChecklistClientPageProps
    extends Pick<KappaChecklistPageData, "collectorQuest" | "unresolvedItemIds" | "errors"> {
    collectorItems: ItemSummary[];
}

const VIEW_OPTIONS: Array<{ value: KappaViewMode; label: string }> = [
    { value: "all", label: "All" },
    { value: "need", label: "Need" },
];
const EMPTY_ITEMS: ItemSummary[] = [];

export function KappaChecklistClientPage({
    collectorQuest,
    collectorItems: initialItems,
    unresolvedItemIds,
    errors,
}: KappaChecklistClientPageProps) {
    const collectorItems = useDeferredPriceItems(initialItems) ?? EMPTY_ITEMS;
    const [selectedItem, setSelectedItem] = useState<ItemSummary | null>(null);
    const gameMode = useUserStore((state) => state.gameMode);
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

    const sortedCollectorItems = useMemo(
        () =>
            [...collectorItems].sort((a, b) =>
                a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
            ),
        [collectorItems],
    );
    const visibleItems = useMemo(
        () =>
            viewMode === "need"
                ? sortedCollectorItems.filter((item) => !completedItems[item.id])
                : sortedCollectorItems,
        [sortedCollectorItems, completedItems, viewMode],
    );
    const completedCount = sortedCollectorItems.reduce(
        (count, item) => count + (completedItems[item.id] ? 1 : 0),
        0,
    );
    const collectorItemCount = sortedCollectorItems.length + unresolvedItemIds.length;

    const errorMessages = [
        ...(errors.quests ? [errors.quests] : []),
        ...(errors.items ? [errors.items] : []),
        ...(!collectorQuest
            ? ["The Collector quest could not be found for this game mode."]
            : []),
        ...(collectorQuest && collectorItems.length === 0 && unresolvedItemIds.length === 0
            ? ["The Collector quest does not currently include any required items."]
            : []),
    ];
    const catalogWarning =
        unresolvedItemIds.length > 0
            ? `${unresolvedItemIds.length} Collector item${
                  unresolvedItemIds.length === 1 ? " could" : "s could"
              } not be matched to the item catalog. The checklist total still includes ${
                  unresolvedItemIds.length === 1 ? "it" : "them"
              }.`
            : null;

    return (
        <main className="container mx-auto px-6 py-8">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">
                        KAPPA REQUIRED ITEMS
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {completedCount} of {collectorItemCount} collected
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
                    {collectorQuest && (
                        <Link
                            href={`/quests#quest-${collectorQuest.id}`}
                            aria-label="Open Collector quest"
                            className="inline-flex h-[46px] items-center gap-2 rounded-md border border-highlight/10 bg-shadow/30 px-3 text-sm font-semibold text-foreground transition-colors hover:border-brand/40 hover:bg-brand/5 hover:text-foreground"
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
                        className="inline-flex rounded-md border border-highlight/10 bg-shadow/30 p-1"
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
                                            ? "bg-brand text-inverse"
                                            : "text-muted-foreground hover:bg-highlight/5 hover:text-foreground"
                                    }`}
                                >
                                    {option.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {errorMessages.length > 0 ? (
                <DataLoadError
                    title="Kappa checklist data is unavailable"
                    messages={errorMessages}
                />
            ) : (
                <>
                    {catalogWarning && (
                        <div
                            role="alert"
                            className="mb-4 rounded border border-warning/30 bg-warning-surface/30 px-4 py-3 text-sm text-warning"
                        >
                            {catalogWarning}
                        </div>
                    )}
                    {visibleItems.length === 0 ? (
                <div className={`rounded-lg border px-5 py-10 text-center text-sm text-foreground ${
                    unresolvedItemIds.length > 0
                        ? "border-warning/20 bg-warning/5"
                        : "border-success/20 bg-success/5"
                }`}>
                    {unresolvedItemIds.length > 0
                        ? "No matched Collector items are available to display."
                        : "You have collected every Kappa item."}
                </div>
            ) : (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10">
                    {visibleItems.map((item) => {
                        const isCompleted = !!completedItems[item.id];
                        return (
                            <li
                                key={item.id}
                                className={`flex min-w-0 overflow-hidden rounded-md border bg-card transition-colors ${
                                    isCompleted ? "border-success/40" : "border-highlight/10"
                                }`}
                            >
                                <button
                                    type="button"
                                    onClick={() => setSelectedItem(item)}
                                    className="group relative aspect-square min-w-0 flex-1 overflow-hidden bg-shadow/35 transition-colors hover:bg-shadow/55 focus-visible:z-10"
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
                                        <span className="flex h-full items-center justify-center text-xl text-subtle-foreground">
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
                                            ? "border-success/30 bg-success/15 text-success hover:bg-success/25"
                                            : "border-highlight/10 text-subtle-foreground hover:bg-highlight/5 hover:text-foreground"
                                    }`}
                                >
                                    <Check aria-hidden="true" className="size-5" strokeWidth={2.5} />
                                </button>
                            </li>
                        );
                    })}
                </ul>
                    )}
                </>
            )}

            <p className="mt-6 flex items-center gap-2 text-sm text-warning/90">
                <BadgeCheck aria-hidden="true" className="size-4 shrink-0" />
                All Collector items must be found in raid.
            </p>

            {selectedItem && (
                <ItemDetailModal
                    item={collectorItems.find((item) => item.id === selectedItem.id) ?? selectedItem}
                    isOpen
                    onClose={() => setSelectedItem(null)}
                />
            )}
        </main>
    );
}
