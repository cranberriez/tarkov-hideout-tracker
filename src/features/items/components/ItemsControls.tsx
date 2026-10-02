"use client";

import { type ChecklistSort, type ChecklistSortKey } from "../checklist-sort";
import { useId } from "react";
import { FilterPanel } from "@/components/ui/filter-bar";
import { useShallow } from "zustand/react/shallow";
import { useUserStore } from "@/lib/stores/useUserStore";
import { ItemsFiltersPanel } from "./controls/ItemsFiltersPanel";
import { ItemsToolbar } from "./controls/ItemsToolbar";

interface ItemsControlsProps {
	sort: ChecklistSort;
	onSortSelect: (key: ChecklistSortKey) => void;
	searchQuery: string;
	onSearchQueryChange: (query: string) => void;
	children: React.ReactNode;
}

export function ItemsControls({ searchQuery, onSearchQueryChange, sort, onSortSelect, children }: ItemsControlsProps) {
	const panelId = useId();
	const {
		itemFiltersOpen,
		setItemFiltersOpen,
		checklistViewMode,
		setChecklistViewMode,
		showHidden,
		setShowHidden,
		hideCheap,
		setHideCheap,
		itemsSize,
		setItemsSize,
		cheapPriceThreshold,
		setCheapPriceThreshold,
		useCategorization,
		setUseCategorization,
		showFirOnly,
		setShowFirOnly,
		itemSourceFilter,
		setItemSourceFilter,
		itemShowPinnedQuestOnly,
		setItemShowPinnedQuestOnly,
		itemQuestVisibilityMode,
		itemQuestCustomLookahead,
		itemQuestCustomLevelLookahead,
		itemShowFutureFir,
		itemShowIgnored,
		setItemQuestVisibilityMode,
		setItemQuestCustomLookahead,
		setItemQuestCustomLevelLookahead,
		setItemShowFutureFir,
		setItemShowIgnored,
	} = useUserStore(
		useShallow((state) => ({
			itemFiltersOpen: state.itemFiltersOpen,
			setItemFiltersOpen: state.setItemFiltersOpen,
			checklistViewMode: state.checklistViewMode,
			setChecklistViewMode: state.setChecklistViewMode,
			showHidden: state.showHidden,
			setShowHidden: state.setShowHidden,
			hideCheap: state.hideCheap,
			setHideCheap: state.setHideCheap,
			itemsSize: state.itemsSize,
			setItemsSize: state.setItemsSize,
			cheapPriceThreshold: state.cheapPriceThreshold,
			setCheapPriceThreshold: state.setCheapPriceThreshold,
			useCategorization: state.useCategorization,
			setUseCategorization: state.setUseCategorization,
			showFirOnly: state.showFirOnly,
			setShowFirOnly: state.setShowFirOnly,
			itemSourceFilter: state.itemSourceFilter,
			setItemSourceFilter: state.setItemSourceFilter,
			itemShowPinnedQuestOnly: state.itemShowPinnedQuestOnly,
			setItemShowPinnedQuestOnly: state.setItemShowPinnedQuestOnly,
			itemQuestVisibilityMode: state.itemQuestVisibilityMode,
			itemQuestCustomLookahead: state.itemQuestCustomLookahead,
			itemQuestCustomLevelLookahead: state.itemQuestCustomLevelLookahead,
			itemShowFutureFir: state.itemShowFutureFir,
			itemShowIgnored: state.itemShowIgnored,
			setItemQuestVisibilityMode: state.setItemQuestVisibilityMode,
			setItemQuestCustomLookahead: state.setItemQuestCustomLookahead,
			setItemQuestCustomLevelLookahead: state.setItemQuestCustomLevelLookahead,
			setItemShowFutureFir: state.setItemShowFutureFir,
			setItemShowIgnored: state.setItemShowIgnored,
		})),
	);

	return (
		<div className="space-y-3">
			<ItemsToolbar
				filtersOpen={itemFiltersOpen}
				onToggleFilters={() => setItemFiltersOpen(!itemFiltersOpen)}
				sort={sort}
				onSortSelect={onSortSelect}
				searchQuery={searchQuery}
				onSearchQueryChange={onSearchQueryChange}
				panelId={panelId}
				itemSourceFilter={itemSourceFilter}
				onItemSourceFilterChange={setItemSourceFilter}
				itemsSize={itemsSize}
				onItemsSizeChange={setItemsSize}
				showFirOnly={showFirOnly}
				onShowFirOnlyChange={setShowFirOnly}
				useCategorization={useCategorization}
				onUseCategorizationChange={setUseCategorization}
			/>

			<div className="relative min-h-0">
				<FilterPanel
					id={panelId}
					open={itemFiltersOpen}
					onOpenChange={setItemFiltersOpen}
					onKeyDown={(event) => {
						if (event.key === "Escape") {
							setItemFiltersOpen(false);
							document.querySelector<HTMLButtonElement>(`[aria-controls="${panelId}"]`)?.focus();
						}
					}}
				>
					<ItemsFiltersPanel
						checklistViewMode={checklistViewMode}
						onChecklistViewModeChange={setChecklistViewMode}
						showHidden={showHidden}
						onShowHiddenChange={setShowHidden}
						itemQuestVisibilityMode={itemQuestVisibilityMode}
						onItemQuestVisibilityModeChange={setItemQuestVisibilityMode}
						itemQuestCustomLookahead={itemQuestCustomLookahead}
						onItemQuestCustomLookaheadChange={setItemQuestCustomLookahead}
						itemQuestCustomLevelLookahead={itemQuestCustomLevelLookahead}
						onItemQuestCustomLevelLookaheadChange={setItemQuestCustomLevelLookahead}
						itemShowPinnedQuestOnly={itemShowPinnedQuestOnly}
						onItemShowPinnedQuestOnlyChange={setItemShowPinnedQuestOnly}
						itemShowFutureFir={itemShowFutureFir}
						onItemShowFutureFirChange={setItemShowFutureFir}
						itemShowIgnored={itemShowIgnored}
						onItemShowIgnoredChange={setItemShowIgnored}
						hideCheap={hideCheap}
						onHideCheapChange={setHideCheap}
						cheapPriceThreshold={cheapPriceThreshold}
						onCheapPriceThresholdChange={setCheapPriceThreshold}
						className="w-full"
					/>
				</FilterPanel>

				<div className="min-w-0 flex-1">{children}</div>
			</div>
		</div>
	);
}
