"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, Filter, Grid3X3, LayoutList, List } from "lucide-react";
import {
	FilterBar,
	FilterPanelButton,
	FilterSearchInput,
	FilterRadioGroup,
	FilterToggle,
} from "@/components/ui/filter-bar";
import { FilterMenuItem, FilterMultiSelect } from "@/components/ui/filter-multi-select";
import { CHECKLIST_SORT_OPTIONS, type ChecklistSort, type ChecklistSortKey } from "../../checklist-sort";
import type { ItemSize, ItemSourceFilter } from "@/lib/stores/useUserStore";

interface ItemsToolbarProps {
	sort: ChecklistSort;
	onSortSelect: (key: ChecklistSortKey) => void;
	filtersOpen: boolean;
	onToggleFilters: () => void;
	searchQuery: string;
	onSearchQueryChange: (query: string) => void;
	panelId: string;
	itemSourceFilter: ItemSourceFilter;
	onItemSourceFilterChange: (value: ItemSourceFilter) => void;
	itemsSize: ItemSize;
	onItemsSizeChange: (value: ItemSize) => void;
	showFirOnly: boolean;
	onShowFirOnlyChange: (value: boolean) => void;
	useCategorization: boolean;
	onUseCategorizationChange: (value: boolean) => void;
}

export function ItemsToolbar({
	sort,
	onSortSelect,
	filtersOpen,
	onToggleFilters,
	searchQuery,
	onSearchQueryChange,
	panelId,
	itemSourceFilter,
	onItemSourceFilterChange,
	itemsSize,
	onItemsSizeChange,
	showFirOnly,
	onShowFirOnlyChange,
	useCategorization,
	onUseCategorizationChange,
}: ItemsToolbarProps) {
	return (
		<FilterBar aria-label="Item filters">
			<FilterPanelButton open={filtersOpen} panelId={panelId} onClick={onToggleFilters}>
				<Filter size={14} /> Filters
			</FilterPanelButton>
			<FilterMultiSelect
				label="Sort"
				contentClassName="w-[260px] p-2"
				summary={
					<>
						<ArrowUpDown size={14} /> Sort
					</>
				}
			>
				{CHECKLIST_SORT_OPTIONS.map(({ key, label }) => {
					const active = sort.key === key;
					const direction = sort.direction === "asc" ? "ascending" : "descending";
					return (
						<FilterMenuItem
							key={key}
							aria-label={active ? `${label}, ${direction}. Click to reverse` : label}
							className={`gap-2 px-3 py-2 text-sm ${active ? "bg-brand/8 text-brand focus:text-brand" : ""}`}
							onSelect={() => onSortSelect(key)}
						>
							{label}
							{active &&
								(sort.direction === "asc" ? (
									<ArrowUp className="text-brand" aria-hidden="true" />
								) : (
									<ArrowDown className="text-brand" aria-hidden="true" />
								))}
						</FilterMenuItem>
					);
				})}
			</FilterMultiSelect>
			<FilterSearchInput
				label="Search checklist items"
				placeholder="Search checklist items..."
				value={searchQuery}
				onValueChange={onSearchQueryChange}
			/>
			<FilterRadioGroup
				label="Item source"
				value={itemSourceFilter}
				onValueChange={onItemSourceFilterChange}
				className="min-w-[160px] flex-1"
				options={[
					{ value: "all", label: "All" },
					{ value: "hideout", label: "Hideout" },
					{ value: "quest", label: "Quests" },
				]}
			/>
			<FilterRadioGroup
				label="Item size"
				value={itemsSize}
				onValueChange={onItemsSizeChange}
				className="shrink-0"
				options={[
					{ value: "Icon", label: "Icon", icon: <Grid3X3 size={13} /> },
					{ value: "Compact", label: "Compact", icon: <List size={13} /> },
					{ value: "Expanded", label: "Expanded", icon: <LayoutList size={13} /> },
				]}
			/>
			<FilterToggle checked={showFirOnly} onCheckedChange={onShowFirOnlyChange}>
				FiR Only
			</FilterToggle>
			<FilterToggle checked={useCategorization} onCheckedChange={onUseCategorizationChange}>
				Categorize
			</FilterToggle>
		</FilterBar>
	);
}
