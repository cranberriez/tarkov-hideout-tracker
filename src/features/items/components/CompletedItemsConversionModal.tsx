"use client";

import { useMemo } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useDataStore } from "@/lib/stores/useDataStore";

interface CompletedItemsConversionModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function CompletedItemsConversionModal({ isOpen, onClose }: CompletedItemsConversionModalProps) {
    const { stations, items } = useDataStore();
    const { stationLevels, completedRequirements, addItemCounts } = useUserStore();

    const conversions = useMemo(() => {
        if (!stations) return [] as {
            itemId: string;
            itemName: string;
            total: number;
            totalFir: number;
        }[];

        const map = new Map<
            string,
            {
                itemId: string;
                itemName: string;
                total: number;
                totalFir: number;
            }
        >();

        stations.forEach((station) => {
            const currentLevel = stationLevels[station.id] ?? 0;

            station.levels.forEach((level) => {
                // Ignore requirements for levels that are already reached or surpassed
                if (currentLevel >= level.level) return;

                level.itemRequirements.forEach((req) => {
                    if (!completedRequirements[req.id]) return;

                    const quantity = req.count ?? req.quantity ?? 0;
                    if (quantity <= 0) return;

                    const isFir = req.attributes.some(
                        (attr) => attr.name === "found_in_raid" && attr.value === "true"
                    );

                    const existing = map.get(req.item.id) ?? {
                        itemId: req.item.id,
                        itemName: items?.[req.item.id]?.name ?? req.item.name ?? req.item.id,
                        total: 0,
                        totalFir: 0,
                    };

                    existing.total += quantity;
                    if (isFir) {
                        existing.totalFir += quantity;
                    }

                    map.set(req.item.id, existing);
                });
            });
        });

        return Array.from(map.values()).sort((a, b) => a.itemName.localeCompare(b.itemName));
    }, [stations, stationLevels, completedRequirements, items]);

    const handleApply = () => {
        conversions.forEach(({ itemId, total, totalFir }) => {
            const nonFir = total - totalFir;
            addItemCounts(itemId, nonFir, totalFir);
        });

        onClose();
    };

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-xl p-4">
                <DialogTitle className="text-sm font-semibold tracking-[0.2em] text-gray-400 mb-2">
                    ITEM PROGRESS UPDATE
                </DialogTitle>
                <div className="text-xs text-gray-400 mb-4 space-y-2">
                    <p className="font-medium text-gray-300">Some things have changed.</p>
                    <p>
                        We now track how many items you have, including how many are Found in Raid. Any hideout
                        requirements you previously marked as completed (for future levels) can be converted into
                        item counts here.
                    </p>
                    <p>
                        Requirements for station levels you have already reached are ignored.
                    </p>
                </div>

                {conversions.length === 0 ? (
                    <div className="text-xs text-gray-500">
                        There are currently no eligible completed hideout requirements to convert. Once you
                        mark future-level requirements as completed, they will appear here so you can turn
                        them into item counts.
                    </div>
                ) : (
                    <div className="max-h-64 overflow-y-auto border border-border-color rounded-sm mb-4">
                        <table className="w-full text-xs">
                            <thead className="bg-black/40 text-gray-400 border-b border-border-color">
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
                                        <td className="px-3 py-1.5 text-gray-200 truncate" title={itemName}>
                                            {itemName}
                                        </td>
                                        <td className={`px-3 py-1.5 text-right ${totalNonFir > 0 ? "text-tarkov-green" : "text-gray-400"} font-mono`}>
                                            {totalNonFir > 0 ? totalNonFir : "-"}
                                        </td>
                                        <td className={`px-3 py-1.5 text-right ${totalFir > 0 ? "text-orange-400" : "text-gray-400"} font-mono`}>
                                            {totalFir > 0 ? totalFir : "-"}
                                        </td>
                                    </tr>
                                )})}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="flex justify-end gap-2 mt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-1.5 text-xs rounded-sm border border-border-color text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                    >
                        Close
                    </button>
                    {conversions.length > 0 && (
                        <button
                            type="button"
                            onClick={handleApply}
                            className="px-4 py-1.5 text-xs rounded-sm font-semibold bg-tarkov-green text-black hover:bg-lime-300 transition-colors"
                        >
                            Apply Conversion
                        </button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
