"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import Image from "next/image";
import { ArrowLeft, Bug, PackageOpen, X } from "lucide-react";
import type { ItemSummary } from "@/types/items";
import { ItemDetailHeader } from "./ItemDetailHeader";
import { ItemDetailSidebar } from "./ItemDetailSidebar";
import { ItemDetailUsageTabs } from "./ItemDetailUsageTabs";
import { useItemDetailModalController } from "./useItemDetailModalController";
import { ItemDetailLoading, ITEM_DETAIL_LOADING_CLASS } from "./ItemDetailLoading";

export interface ItemDetailModalProps {
    item: ItemSummary | null;
    isOpen: boolean;
    onClose: () => void;
}

export function ItemDetailModal(props: ItemDetailModalProps) {
    const vm = useItemDetailModalController(props);
    const { selectedItem } = vm;
    if (!selectedItem) return null;
    // Expand after the initial detail domains settle. Errors must remain visible;
    // acquisition/profit requests retain their own loading states in the full UI.
    const loading = (vm.relationsLoading || vm.usageLoading) && !vm.relationsError && !vm.usageError;

    return (
        <Dialog open={props.isOpen} onOpenChange={(open) => !open && vm.close()}>
            <DialogContent
                showCloseButton={loading}
                aria-busy={loading}
                aria-describedby={undefined}
                className={loading ? ITEM_DETAIL_LOADING_CLASS : "w-full overflow-visible border-0 bg-transparent p-0 shadow-none sm:max-w-4xl lg:max-w-5xl transition-[max-width] duration-200 motion-reduce:transition-none"}
            >
                <DialogTitle className="sr-only">{selectedItem.name}</DialogTitle>
                {loading ? <ItemDetailLoading item={selectedItem} /> : <>
                {vm.previousItem && (
                    <button
                        type="button"
                        onClick={vm.back}
                        className="absolute bottom-full left-0 mb-2 inline-flex h-10 items-center gap-2 rounded-md bg-background px-3 text-sm font-medium text-foreground shadow-2xl transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/70"
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
                        <section className="flex min-h-[420px] min-w-0 flex-col overflow-hidden bg-[var(--background)]">
                            <header className="flex items-center justify-between border-b border-border-color px-4 py-3">
                                <div>
                                    <p className="text-xs font-semibold text-foreground">Item debug data</p>
                                    <p className="mt-0.5 text-[10px] text-muted-foreground">Item and related modal data</p>
                                </div>
                                <button type="button" onClick={vm.close} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-highlight/5 hover:text-foreground" aria-label="Close item details">
                                    <X size={18} />
                                </button>
                            </header>
                            <pre className="min-h-0 flex-1 overflow-auto p-4 text-[10px] leading-relaxed text-muted-foreground">
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
                                <button type="button" onClick={vm.close} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-muted-foreground transition-colors hover:border-border-color hover:bg-shadow/20 hover:text-foreground sm:right-4 sm:top-4" aria-label="Close item details">
                                    <X size={18} />
                                </button>
                            </header>

                            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:overflow-hidden">
                                <div className={`grid min-h-0 grid-cols-1 gap-0 lg:flex-1 ${vm.showSidebar ? "lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]" : ""}`}>
                                    {vm.showSidebar && (
                                        <ItemDetailSidebar
                                            key={vm.selectedItemId}
                                            itemId={vm.selectedItemId}
                                            owned={vm.owned}
                                            marketPrice={vm.marketPrice}
                                            priceLoadState={selectedItem.priceLoadState}
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
                                        onRetryRelations={vm.retryRelations}
                                        acquisitionLoading={vm.usageLoading}
                                        barterError={vm.barterError}
                                        craftError={vm.craftError}
                                        onRetryAcquisition={vm.retryUsage}
                                        acquisitionWarning={vm.usagePresentationError}
                                        completedQuests={vm.completedQuests}
                                        traderLoyaltyLevels={vm.traderLoyaltyLevels}
                                        gameEdition={vm.gameEdition}
                                        gameMode={vm.tarkovMode}
                                        showPriceHistory={vm.showPriceHistory}
                                        barterEvaluationsById={vm.barterEvaluationsById}
                                        craftEvaluationsById={vm.craftEvaluationsById}
                                        overrides={vm.overrides}
                                        profitLoading={vm.profitLoading}
                                        profitError={vm.profitError}
                                        onRetryProfit={vm.retryProfit}
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
                        className={`absolute -bottom-2.5 -right-2.5 z-[60] flex h-6 w-6 items-center justify-center rounded-full border bg-[var(--card-bg)] shadow-xl transition-colors ${vm.showDebug ? "border-brand/50 text-brand" : "border-highlight/15 text-subtle-foreground hover:border-highlight/30 hover:text-foreground"}`}
                    >
                        <Bug size={11} />
                    </button>
                )}
                </>}
            </DialogContent>
        </Dialog>
    );
}
