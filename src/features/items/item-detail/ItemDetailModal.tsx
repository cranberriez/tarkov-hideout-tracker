"use client";

import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { ItemDetails, Station } from "@/types";
import { X } from "lucide-react";
import { stationOrder } from "@/lib/cfg/stationOrder";
import { useUserStore } from "@/lib/stores/useUserStore";
import { formatRelativeUpdatedAt } from "@/lib/utils/format-time";
import { computeNeeds } from "@/lib/utils/item-needs";
import { ItemDetailHeader } from "./ItemDetailHeader";
import { ItemDetailInventoryAndMarket } from "./ItemDetailInventoryAndMarket";
import { ItemDetailHideoutRequirements } from "./ItemDetailHideoutRequirements";
import { usePriceDataContext } from "@/app/(data)/_priceDataContext";

export interface ItemDetailModalProps {
    item: ItemDetails | null;
    isOpen: boolean;
    onClose: () => void;
    stations: Station[] | null;
    stationLevels: Record<string, number>;
    hiddenStations: Record<string, boolean>;
    completedRequirements: Record<string, boolean>;
    toggleRequirement: (requirementId: string) => void;
}

export function ItemDetailModal({
    item,
    isOpen,
    onClose,
    stations,
    stationLevels,
    hiddenStations,
    completedRequirements,
    toggleRequirement,
}: ItemDetailModalProps) {
    if (!item) return null;

    const stationRequirements = useMemo(() => {
        if (!stations) return [];

        const reqs: {
            stationName: string;
            stationNormalizedName: string;
            stationId: string;
            level: number;
            count: number;
            isFir: boolean;
            isCompleted: boolean;
            isStationMaxed: boolean;
            requirementId: string;
        }[] = [];

        stations.forEach((station) => {
            const currentLevel = stationLevels[station.id] ?? 0;
            const maxLevel =
                station.levels.length > 0 ? station.levels[station.levels.length - 1].level : 0;
            const isStationMaxed = currentLevel >= maxLevel;

            station.levels.forEach((level) => {
                level.itemRequirements.forEach((req) => {
                    if (req.item.id === item.id) {
                        const isFir = req.attributes.some(
                            (attr) => attr.name === "found_in_raid" && attr.value === "true"
                        );
                        reqs.push({
                            stationName: station.name,
                            stationNormalizedName: station.normalizedName,
                            stationId: station.id,
                            level: level.level,
                            count: req.count ?? req.quantity ?? 0,
                            isFir,
                            isCompleted: currentLevel >= level.level,
                            isStationMaxed,
                            requirementId: req.id,
                        });
                    }
                });
            });
        });

        const grouped: Record<string, typeof reqs> = {};
        reqs.forEach((req) => {
            if (!grouped[req.stationName]) {
                grouped[req.stationName] = [];
            }
            grouped[req.stationName].push(req);
        });

        const orderMap = new Map(stationOrder.map((name, index) => [name, index] as const));
        const getOrder = (normalizedName: string) => orderMap.get(normalizedName) ?? 999;

        return Object.entries(grouped).sort((a, b) => {
            const reqA = a[1][0];
            const reqB = b[1][0];

            if (reqA.isStationMaxed && !reqB.isStationMaxed) return 1;
            if (!reqA.isStationMaxed && reqB.isStationMaxed) return -1;

            return getOrder(reqA.stationNormalizedName) - getOrder(reqB.stationNormalizedName);
        });
    }, [item, stations, stationLevels]);

    const { marketPricesByMode, loading: pricesLoading } = usePriceDataContext();
    const { gameMode } = useUserStore();
    const mode = gameMode === "PVE" ? "PVE" : "PVP";
    const priceBucket = marketPricesByMode[mode];
    const loading = pricesLoading || !priceBucket || priceBucket.updatedAt === null;
    const marketPrice = priceBucket?.prices[item.normalizedName];

    const formatPrice = (price?: number) => {
        if (price === undefined) return "-";
        return new Intl.NumberFormat("en-US").format(price) + " ₽";
    };

    const renderMarketValue = (value?: number) => {
        if (loading && !marketPrice) return "...";
        if (!loading && (!marketPrice || value === undefined)) return "-";
        return formatPrice(value);
    };

    const renderPercentChange = (value?: number) => {
        if (loading && !marketPrice) return "...";
        if (!loading && (!marketPrice || value === undefined)) return "-";
        if (value === undefined) return "-";
        return `${value.toFixed(2)}%`;
    };

    const { totalCount, totalFir } = useMemo(() => {
        let totalCount = 0;
        let totalFir = 0;

        stationRequirements.forEach(([, reqs]) => {
            reqs.forEach((req) => {
                const isManuallyCompleted = completedRequirements[req.requirementId];

                if (req.isCompleted || isManuallyCompleted) {
                    return;
                }

                totalCount += req.count;
                if (req.isFir) {
                    totalFir += req.count;
                }
            });
        });

        return { totalCount, totalFir };
    }, [stationRequirements, completedRequirements]);

    const isRouble = item.normalizedName === "roubles";
    const isDollar = item.normalizedName === "dollars";
    const isEuro = item.normalizedName === "euros";
    const isFiat = isDollar || isEuro;

    const itemUpdatedTimestamp = (() => {
        if (!marketPrice?.updated) return null;
        const parsed = Date.parse(marketPrice.updated);
        if (Number.isNaN(parsed)) return null;
        return parsed;
    })();

    const relativeUpdatedAt = formatRelativeUpdatedAt(itemUpdatedTimestamp);

    const { itemCounts, addItemCounts } = useUserStore();
    const owned = itemCounts[item.id] ?? { have: 0, haveFir: 0 };

    const needsBreakdown = useMemo(() => {
        if (totalCount === 0) {
            return null;
        }
        return computeNeeds({
            totalRequired: totalCount,
            requiredFir: totalFir,
            haveNonFir: owned.have,
            haveFir: owned.haveFir,
        });
    }, [totalCount, totalFir, owned.have, owned.haveFir]);

    const [draftNonFir, setDraftNonFir] = useState(owned.have);
    const [draftFir, setDraftFir] = useState(owned.haveFir);

    const hasInventoryChanges = draftNonFir !== owned.have || draftFir !== owned.haveFir;

    const handleCancelInventoryChanges = () => {
        setDraftNonFir(owned.have);
        setDraftFir(owned.haveFir);
    };

    const handleConfirmInventoryChanges = () => {
        if (!hasInventoryChanges) return;

        const haveDelta = draftNonFir - owned.have;
        const haveFirDelta = draftFir - owned.haveFir;

        if (haveDelta !== 0 || haveFirDelta !== 0) {
            addItemCounts(item.id, haveDelta, haveFirDelta);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                showCloseButton={false}
                className="w-full sm:max-w-3xl md:max-w-5xl max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col"
            >
                <DialogTitle className="sr-only">{item.name}</DialogTitle>
                <div className="flex items-start justify-between p-3 sm:p-5 border-b border-border-color bg-card">
                    <ItemDetailHeader
                        item={item}
                        marketPrice={marketPrice}
                        totalCount={totalCount}
                        owned={owned}
                        needsBreakdown={needsBreakdown}
                    />
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground p-2 hover:bg-white/10 rounded-full transition-colors shrink-0"
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-background">
                    <div
                        className={`grid grid-cols-1 ${
                            isRouble ? "lg:grid-cols-2" : "lg:grid-cols-3"
                        } gap-5`}
                    >
                        {!isRouble && (
                            <ItemDetailInventoryAndMarket
                                isFiat={isFiat}
                                marketPrice={marketPrice}
                                loading={loading}
                                relativeUpdatedAt={relativeUpdatedAt}
                                draftNonFir={draftNonFir}
                                draftFir={draftFir}
                                setDraftNonFir={setDraftNonFir}
                                setDraftFir={setDraftFir}
                                hasInventoryChanges={hasInventoryChanges}
                                onCancelChanges={handleCancelInventoryChanges}
                                onConfirmChanges={handleConfirmInventoryChanges}
                                renderMarketValue={renderMarketValue}
                                renderPercentChange={renderPercentChange}
                            />
                        )}

                        <ItemDetailHideoutRequirements
                            stationRequirements={stationRequirements}
                            stationLevels={stationLevels}
                            hiddenStations={hiddenStations}
                        />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
