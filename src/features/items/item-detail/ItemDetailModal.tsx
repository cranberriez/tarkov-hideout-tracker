"use client";

import { DialogTitle } from "@/components/ui/dialog";
import Image from "next/image";
import { ArrowLeft, Bug, PackageOpen, X } from "lucide-react";
import type { ItemSummary } from "@/types/items";
import { ItemDetailHeader } from "./ItemDetailHeader";
import { ItemDetailSidebar } from "./ItemDetailSidebar";
import { ItemDetailUsageTabs } from "./ItemDetailUsageTabs";
import { useItemDetailModalController } from "./useItemDetailsController";
import { ItemDetailLoading, ITEM_DETAIL_LOADING_CLASS } from "./ItemDetailLoading";

export interface ItemDetailModalProps {
	item: ItemSummary | null;
	isOpen: boolean;
	previousItem: ItemSummary | null;
	onBack: () => void;
	onClose: () => void;
}

export function ItemDetailModalContent(props: ItemDetailModalProps) {
	const vm = useItemDetailModalController(props);
	const { selectedItem } = vm;
	if (!selectedItem) return null;
	// Expand after the initial detail domains settle. Errors must remain visible;
	// acquisition/profit requests retain their own loading states in the full UI.
	const loading = vm.initialDetailLoading;

	return (
		<div
			aria-busy={loading}
			className={
				loading
					? ITEM_DETAIL_LOADING_CLASS
					: "pointer-events-auto relative mx-auto w-full max-w-full transition-[max-width] duration-200 motion-reduce:transition-none"
			}
		>
			<DialogTitle className="sr-only">{selectedItem.name}</DialogTitle>
			{loading ? (
				<ItemDetailLoading item={selectedItem} onClose={vm.close} />
			) : (
				<>
					{vm.previousItem && (
						<button
							type="button"
							onClick={vm.back}
							className="flex h-12 w-full items-center gap-2 border-b border-border-color bg-background px-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/70 lg:absolute lg:bottom-full lg:left-0 lg:mb-2 lg:h-10 lg:w-auto lg:rounded-md lg:border-0 lg:shadow-2xl"
							aria-label="Back to previous item"
						>
							<ArrowLeft size={16} aria-hidden="true" />
							{vm.previousItem.iconLink ? (
								<Image
									src={vm.previousItem.iconLink}
									alt=""
									width={28}
									height={28}
									unoptimized
									className="h-7 w-7 object-contain"
								/>
							) : (
								<PackageOpen className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
							)}
							<span>Back</span>
						</button>
					)}
					<div
						className={`flex w-full flex-col bg-background lg:min-h-0 lg:overflow-hidden lg:rounded-lg lg:border lg:border-border-color lg:shadow-2xl ${vm.previousItem ? "min-h-[calc(100dvh-3rem)] lg:max-h-[calc(92vh-3rem)]" : "min-h-dvh lg:max-h-[92vh]"}`}
					>
						{vm.showDebug && vm.isDevelopment ? (
							<section className="flex min-h-[420px] min-w-0 flex-col overflow-hidden bg-[var(--background)]">
								<header className="flex items-center justify-between border-b border-border-color px-4 py-3">
									<div>
										<p className="text-xs font-semibold text-foreground">Item debug data</p>
										<p className="mt-0.5 text-[10px] text-muted-foreground">Item and related modal data</p>
									</div>
									<button
										type="button"
										onClick={vm.close}
										className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-highlight/5 hover:text-foreground"
										aria-label="Close item details"
									>
										<X size={18} />
									</button>
								</header>
								<pre className="min-h-0 flex-1 overflow-auto p-4 text-[10px] leading-relaxed text-muted-foreground">
									{JSON.stringify(vm.debugData, null, 2)}
								</pre>
							</section>
						) : (
							<>
								<header className="relative shrink-0 border-b border-border-color bg-gradient-to-br from-card via-card to-background py-3 pl-3 pr-20 sm:py-4 sm:pl-4 sm:pr-24">
									<ItemDetailHeader
										item={selectedItem}
										totalRequiredCount={vm.demandSummary.totalRequiredCount}
										needsBreakdown={vm.needsBreakdown}
										hideoutRequiredCount={vm.demandSummary.hideoutRequiredCount}
										questRequiredCount={vm.demandSummary.questRequiredCount}
									/>
									<button
										type="button"
										onClick={vm.close}
										className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-muted-foreground transition-colors hover:border-border-color hover:bg-shadow/20 hover:text-foreground sm:right-4 sm:top-4"
										aria-label="Close item details"
									>
										<X size={18} />
									</button>
								</header>

								<div className="flex flex-col lg:min-h-0 lg:flex-1 lg:overflow-hidden">
									<div
										className={`grid shrink-0 grid-cols-1 gap-0 lg:min-h-0 lg:flex-1 lg:shrink ${vm.showSidebar ? "lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]" : ""}`}
									>
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
											usedInBarters={vm.usedInBarters}
											usedInCrafts={vm.usedInCrafts}
											relationsLoading={vm.relationsLoading}
											relationsError={vm.relationsError}
											onRetryRelations={vm.retryRelations}
											acquisitionLoading={vm.usageLoading}
											barterError={vm.barterError}
											craftError={vm.craftError}
											onRetryAcquisition={vm.retryUsage}
											acquisitionWarning={vm.usagePresentationError}
											profileReady={vm.profileReady}
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
							className={`absolute bottom-2 right-2 z-[60] flex h-6 w-6 items-center justify-center rounded-full border bg-[var(--card-bg)] shadow-xl transition-colors lg:-bottom-2.5 lg:-right-2.5 ${vm.showDebug ? "border-brand/50 text-brand" : "border-highlight/15 text-subtle-foreground hover:border-highlight/30 hover:text-foreground"}`}
						>
							<Bug size={11} />
						</button>
					)}
				</>
			)}
		</div>
	);
}
