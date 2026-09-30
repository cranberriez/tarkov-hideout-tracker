"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import type { ItemSummary } from "@/types/items";
import type { InitialItemDetailViews } from "./useItemDetailRequestController";
import { ItemDetailHeader } from "./ItemDetailHeader";
import { ItemDetailSidebar } from "./ItemDetailSidebar";
import { ItemDetailUsageTabs } from "./ItemDetailUsageTabs";
import { useItemDetailsController } from "./useItemDetailsController";

/**
 * `/items/[itemId]` composition. Reuses the item-detail sections without dialog
 * semantics, viewport caps, or in-dialog history: related items are page links.
 */
export function ItemDetailsPage({
	item,
	mode,
	initialViews,
}: {
	item: ItemSummary;
	/** Server data mode, so hydrated views render before the saved profile loads. */
	mode: TarkovJsonGameMode;
	initialViews?: InitialItemDetailViews;
}) {
	const knownItems = useMemo(() => [item], [item]);
	const vm = useItemDetailsController({ activeItemId: item.id, knownItems, enabled: true, mode, initialViews });
	const selectedItem = vm.selectedItem ?? item;

	return (
		<main className="container mx-auto flex flex-col gap-4 px-4 py-6 sm:px-6 sm:py-8">
			<nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-subtle-foreground">
				<Link href="/items" className="transition-colors hover:text-foreground">
					Items
				</Link>
				<ChevronRight size={12} aria-hidden="true" />
				<span aria-current="page" className="truncate text-muted-foreground">
					{selectedItem.name}
				</span>
			</nav>

			<div className="overflow-hidden rounded-lg border border-border-color bg-background">
				<header className="border-b border-border-color bg-gradient-to-br from-card via-card to-background p-4 sm:p-5">
					<ItemDetailHeader
						item={selectedItem}
						headingLevel="h1"
						totalRequiredCount={vm.demandSummary.totalRequiredCount}
						needsBreakdown={vm.needsBreakdown}
						hideoutRequiredCount={vm.demandSummary.hideoutRequiredCount}
						questRequiredCount={vm.demandSummary.questRequiredCount}
					/>
				</header>

				<div className={`grid grid-cols-1 ${vm.showSidebar ? "lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]" : ""}`}>
					{vm.showSidebar && (
						<ItemDetailSidebar
							key={vm.selectedItemId}
							itemId={vm.selectedItemId}
							owned={vm.owned}
							marketPrice={vm.marketPrice}
							priceLoadState={vm.selectedItem?.priceLoadState}
							relativeUpdatedAt={vm.relativeUpdatedAt}
							isFiat={vm.isFiat}
							showMarket={vm.showMarket}
							minLevelForFlea={selectedItem.minLevelForFlea}
							playerLevel={vm.playerLevel}
							onAddItemCounts={vm.addItemCounts}
						/>
					)}
					<ItemDetailUsageTabs
						contained={false}
						renderInactivePanels
						className="min-h-80"
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

			{vm.isDevelopment && (
				<details className="rounded-sm border border-highlight/8 bg-shadow/25">
					<summary className="cursor-pointer px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
						Item debug data
					</summary>
					<pre className="max-h-96 overflow-auto border-t border-highlight/8 p-3 text-[10px] leading-relaxed text-subtle-foreground">
						{JSON.stringify(vm.debugData, null, 2)}
					</pre>
				</details>
			)}
		</main>
	);
}
