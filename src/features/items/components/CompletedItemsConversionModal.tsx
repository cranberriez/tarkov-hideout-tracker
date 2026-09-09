"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toTarkovJsonGameMode } from "@/lib/game-mode";
import { useUserStore } from "@/lib/stores/useUserStore";
import type { CompletedItemsConversionData } from "@/types/contracts";
import {
    buildCompletedItemConversions,
    removeConvertedRequirements,
} from "./completed-items-conversion";

const EMPTY_STATIONS: CompletedItemsConversionData["stations"] = [];
const EMPTY_ITEMS: CompletedItemsConversionData["items"] = [];

interface CompletedItemsConversionModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function CompletedItemsConversionModal({ isOpen, onClose }: CompletedItemsConversionModalProps) {
    const { gameMode, stationLevels, completedRequirements, addItemCounts } = useUserStore();
    const requestedMode = toTarkovJsonGameMode(gameMode);
    const [conversionRequest, setConversionRequest] = useState<{
        mode: string;
        payload: CompletedItemsConversionData | null;
        error: string | null;
    } | null>(null);
    const currentRequest =
        conversionRequest?.mode === requestedMode ? conversionRequest : null;
    const data = currentRequest?.payload ?? null;
    const requestError = currentRequest?.error ?? null;
    const isLoading = isOpen && currentRequest === null;
    const itemNameWarning =
        data?.errors.items ??
        (data && data.unresolvedItemIds.length > 0
            ? "Some item names are unavailable."
            : null);
    const stations = data?.stations ?? EMPTY_STATIONS;
    const items = data?.items ?? EMPTY_ITEMS;

    useEffect(() => {
        if (!isOpen) return;

        const controller = new AbortController();
        fetch(
            `/api/conversion/completed-items?mode=${encodeURIComponent(requestedMode)}`,
            { signal: controller.signal },
        )
            .then(async (response) => {
                if (!response.ok) throw new Error("Conversion data could not be loaded.");
                return response.json() as Promise<CompletedItemsConversionData>;
            })
            .then((payload) =>
                setConversionRequest({ mode: requestedMode, payload, error: null }),
            )
            .catch((error: unknown) => {
                if (error instanceof DOMException && error.name === "AbortError") return;
                setConversionRequest({
                    mode: requestedMode,
                    payload: null,
                    error: "Conversion data could not be loaded.",
                });
            });

        return () => controller.abort();
    }, [isOpen, requestedMode]);

    const { conversions, convertedRequirementIds } = useMemo(
        () => buildCompletedItemConversions(
            stations,
            items,
            stationLevels,
            completedRequirements,
        ),
        [stations, items, stationLevels, completedRequirements],
    );

    const handleApply = () => {
        conversions.forEach(({ itemId, total, totalFir }) => {
            const nonFir = total - totalFir;
            addItemCounts(itemId, nonFir, totalFir);
        });

        const currentCompletedRequirements = useUserStore.getState().completedRequirements;
        useUserStore.getState().applyProfilePatch({
            completedRequirements: removeConvertedRequirements(
                currentCompletedRequirements,
                convertedRequirementIds,
            ),
        });

        onClose();
    };

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-xl p-4">
                <DialogTitle className="text-sm font-semibold tracking-[0.2em] text-muted-foreground mb-2">
                    ITEM PROGRESS UPDATE
                </DialogTitle>
                <div className="text-xs text-muted-foreground mb-4 space-y-2">
                    <p className="font-medium text-foreground">Some things have changed.</p>
                    <p>
                        We now track how many items you have, including how many are Found in Raid. Any hideout
                        requirements you previously marked as completed (for future levels) can be converted into
                        item counts here.
                    </p>
                    <p>
                        Requirements for station levels you have already reached are ignored.
                    </p>
                </div>

                {isLoading ? (
                    <div className="text-xs text-subtle-foreground">Loading conversion data…</div>
                ) : requestError || data?.errors.stations ? (
                    <div className="text-xs text-danger">
                        {requestError ?? data?.errors.stations}
                    </div>
                ) : conversions.length === 0 ? (
                    <div className="text-xs text-subtle-foreground">
                        There are currently no eligible completed hideout requirements to convert. Once you
                        mark future-level requirements as completed, they will appear here so you can turn
                        them into item counts.
                    </div>
                ) : (
                    <div>
                        {itemNameWarning && (
                            <div className="mb-2 text-xs text-warning">
                                {itemNameWarning} Item IDs are shown where names are unavailable.
                            </div>
                        )}
                        <div className="max-h-64 overflow-y-auto border border-border-color rounded-sm mb-4">
                            <table className="w-full text-xs">
                            <thead className="bg-shadow/40 text-muted-foreground border-b border-border-color">
                                <tr>
                                    <th className="text-left px-3 py-2 font-medium">Item</th>
                                    <th className="text-right px-3 py-2 font-medium">Add</th>
                                    <th className="text-right px-3 py-2 font-medium">Add FiR</th>
                                </tr>
                            </thead>
                            <tbody>
                                {conversions.map(({ itemId, itemName, total, totalFir }) => {
                                    const totalNonFir = total - totalFir;

                                    return (
                                    <tr key={itemId} className="border-t border-border-color/40">
                                        <td className="px-3 py-1.5 text-foreground truncate" title={itemName}>
                                            {itemName}
                                        </td>
                                        <td className={`px-3 py-1.5 text-right ${totalNonFir > 0 ? "text-success" : "text-muted-foreground"} font-mono`}>
                                            {totalNonFir > 0 ? totalNonFir : "-"}
                                        </td>
                                        <td className={`px-3 py-1.5 text-right ${totalFir > 0 ? "text-warning" : "text-muted-foreground"} font-mono`}>
                                            {totalFir > 0 ? totalFir : "-"}
                                        </td>
                                    </tr>
                                )})}
                            </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-2 mt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-1.5 text-xs rounded-sm border border-border-color text-muted-foreground hover:text-foreground hover:bg-highlight/5 transition-colors"
                    >
                        Close
                    </button>
                    {conversions.length > 0 && (
                        <button
                            type="button"
                            onClick={handleApply}
                            className="px-4 py-1.5 text-xs rounded-sm font-semibold bg-brand text-inverse hover:bg-brand-hover transition-colors"
                        >
                            Apply Conversion
                        </button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
