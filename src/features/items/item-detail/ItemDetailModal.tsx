"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import Image from "next/image";
import { ArrowLeft, Bug, PackageOpen, X } from "lucide-react";
import type { ItemSummary } from "@/types/items";
import { ItemDetailHeader } from "./ItemDetailHeader";
import { ItemDetailSidebar } from "./ItemDetailSidebar";
import { ItemDetailUsageTabs } from "./ItemDetailUsageTabs";
import { useItemDetailModalController } from "./useItemDetailModalController";

export interface ItemDetailModalProps {
    item: ItemSummary | null;
    isOpen: boolean;
    onClose: () => void;
}

export function ItemDetailModal(props: ItemDetailModalProps) {
    const vm = useItemDetailModalController(props);
    const { selectedItem } = vm;
    if (!selectedItem) return null;

    return (
        <Dialog open={props.isOpen} onOpenChange={(open) => !open && vm.close()}>
            <DialogContent
                showCloseButton={false}
                className="w-full overflow-visible border-0 bg-transparent p-0 shadow-none sm:max-w-4xl lg:max-w-5xl"
            >
                <DialogTitle className="sr-only">{selectedItem.name}</DialogTitle>
                {vm.previousItem && (
                    <button
                        type="button"
                        onClick={vm.back}
                        className="absolute bottom-full left-0 mb-2 inline-flex h-10 items-center gap-2 rounded-md bg-background px-3 text-sm font-medium text-foreground shadow-2xl transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tarkov-green/70"
                        aria-label="Back to previous item"
                    >
                        <ArrowLeft size={16} aria-hidden="true" />
                        {vm.previousItem.iconLink ? (
                            <Image src={vm.previousItem.iconLink} alt="" width={28} height={28} unoptimized className="h-7 w-7 object-contain" />
                        ) : (
                            <PackageOpen className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                        )}
                        <span>Back</span>
                    </button>
                )}
                <div className={`flex w-full flex-col overflow-hidden rounded-lg border border-border-color bg-background shadow-2xl ${vm.previousItem ? "max-h-[calc(92vh-3rem)]" : "max-h-[92vh]"}`}>
                    {vm.showDebug && vm.isDevelopment ? (
                        <section className="flex min-h-[420px] min-w-0 flex-col overflow-hidden bg-[#0b0c0e]">
                            <header className="flex items-center justify-between border-b border-border-color px-4 py-3">
                                <div>
                                    <p className="text-xs font-semibold text-white">Item debug data</p>
                                    <p className="mt-0.5 text-[10px] text-muted-foreground">Item and related modal data</p>
                                </div>
                                <button type="button" onClick={vm.close} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground" aria-label="Close item details">
                                    <X size={18} />
                                </button>
                            </header>
                            <pre className="min-h-0 flex-1 overflow-auto p-4 text-[10px] leading-relaxed text-gray-400">
                                {JSON.stringify(vm.debugData, null, 2)}
                            </pre>
                        </section>
                    ) : (
                        <>
                            <header className="relative border-b border-border-color bg-gradient-to-br from-card via-card to-background py-3 pl-3 pr-20 sm:py-4 sm:pl-4 sm:pr-24">
                                <ItemDetailHeader
                                    item={selectedItem}
                                    totalRequiredCount={vm.demandSummary.totalRequiredCount}
                                    needsBreakdown={vm.needsBreakdown}
                                    hideoutRequiredCount={vm.demandSummary.hideoutRequiredCount}
                                    questRequiredCount={vm.demandSummary.questRequiredCount}
                                />
                                <button type="button" onClick={vm.close} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-muted-foreground transition-colors hover:border-border-color hover:bg-black/20 hover:text-foreground sm:right-4 sm:top-4" aria-label="Close item details">
                                    <X size={18} />
                                </button>
                            </header>

                            <div className="flex-1 overflow-y-auto">
                                <div className={`grid grid-cols-1 gap-0 ${vm.showSidebar ? "lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]" : ""}`}>
                                    {vm.showSidebar && (
                                        <ItemDetailSidebar
                                            key={vm.selectedItemId}
                                            itemId={vm.selectedItemId}
                                            owned={vm.owned}
                                            marketPrice={vm.marketPrice}
                                            relativeUpdatedAt={vm.relativeUpdatedAt}
                                            isFiat={vm.isFiat}
                                            showMarket={vm.showMarket}
                                            minLevelForFlea={selectedItem.minLevelForFlea}
                                            playerLevel={vm.playerLevel}
                                            onAddItemCounts={vm.addItemCounts}
                                        />
                                    )}
                                    <ItemDetailUsageTabs
                                        key={`usage-${vm.selectedItemId}`}
                                        className=""
                                        selectedItemId={selectedItem.id}
                                        selectedItemImageLink={selectedItem.iconLink ?? selectedItem.gridImageLink}
                                        stationRequirements={vm.stationRequirements}
                                        stationLevels={vm.stationLevels}
                                        hiddenStations={vm.hiddenStations}
                                        questItemState={vm.questItemState}
                                        questRewards={vm.questRewards}
                                        anyOfGroups={vm.questAnyOfGroupState}
                                        itemDetailsById={vm.itemDetailsById}
                                        traderOffers={vm.traderOffers}
                                        crafts={vm.crafts}
                                        relationsLoading={vm.relationsLoading}
                                        relationsError={vm.relationsError}
                                        acquisitionLoading={vm.usageLoading}
                                        barterError={vm.barterError}
                                        craftError={vm.craftError}
                                        acquisitionWarning={vm.usagePresentationError}
                                        completedQuests={vm.completedQuests}
                                        traderLoyaltyLevels={vm.traderLoyaltyLevels}
                                        gameEdition={vm.gameEdition}
                                        gameMode={vm.tarkovMode}
                                        showPriceHistory={vm.showPriceHistory}
                                        barterEvaluationsById={vm.barterEvaluationsById}
                                        craftEvaluationsById={vm.craftEvaluationsById}
                                        profitLoading={vm.profitLoading}
                                        profitError={vm.profitError}
                                        onItemClick={vm.openItem}
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </div>
                {vm.isDevelopment && (
                    <button
                        type="button"
                        onClick={vm.toggleDebug}
                        aria-label={vm.showDebug ? "Hide item debug data" : "Show item debug data"}
                        aria-expanded={vm.showDebug}
                        className={`absolute -bottom-2.5 -right-2.5 z-[60] flex h-6 w-6 items-center justify-center rounded-full border bg-[#111316] shadow-xl transition-colors ${vm.showDebug ? "border-tarkov-green/50 text-tarkov-green" : "border-white/15 text-gray-600 hover:border-white/30 hover:text-gray-300"}`}
                    >
                        <Bug size={11} />
                    </button>
                )}
            </DialogContent>
        </Dialog>
    );
}
