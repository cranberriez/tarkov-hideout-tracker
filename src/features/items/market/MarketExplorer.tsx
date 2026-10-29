"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Pin, Search, X } from "lucide-react";
import { ItemImage } from "@/components/entities/item-image";
import { ItemLink } from "@/components/entities/item-link";
import { useUserStore } from "@/lib/stores/useUserStore";
import { cn } from "@/lib/utils";
import type { MarketOverviewItem } from "@/types/contracts";
import {
	bandOf,
	changeOf,
	changeRubOf,
	currentPrice,
	MOVE_BANDS,
	sortMarketItems,
	type ExplorerSortKey,
	type MarketWindow,
	type MoveBandId,
} from "./market-model";
import { changeTone, EMPTY, formatPercent, formatPrice, formatSignedRoubles, toPreviewItem } from "./market-format";
import { RangeBar, Sparkline } from "./MarketCharts";
import { useMarketPins } from "./useMarketPins";

const PAGE_SIZE = 50;

const TREND_LABEL: Record<MarketOverviewItem["trend"], string> = {
	rising: "↑ Rising",
	falling: "↓ Falling",
	stable: "→ Stable",
	unknown: EMPTY,
};

type SortState = { key: ExplorerSortKey; descending: boolean };

interface MarketExplorerProps {
	items: MarketOverviewItem[];
	/** Unfiltered items, so pins stay visible whatever the page filters. */
	allItems: MarketOverviewItem[];
	window: MarketWindow;
	band: MoveBandId | null;
	onClearBand: () => void;
}

/** Pinned items, then every filtered item, searchable and sortable, one page at a time. */
export function MarketExplorer({ items, allItems, window, band, onClearBand }: MarketExplorerProps) {
	const gameMode = useUserStore((state) => state.gameMode);
	const { pinnedIds, togglePin } = useMarketPins(gameMode);
	const [search, setSearch] = useState("");
	const [sort, setSort] = useState<SortState>({ key: "changeRub", descending: true });
	const [page, setPage] = useState(0);
	const query = useDeferredValue(search.trim().toLowerCase());

	const rows = useMemo(() => {
		const matching = items.filter((item) => {
			if (query && !item.name.toLowerCase().includes(query) && !item.shortName?.toLowerCase().includes(query))
				return false;
			if (band === null) return true;
			const change = changeOf(item, window);
			return change !== null && bandOf(change).id === band;
		});
		return sortMarketItems(matching, sort.key, sort.descending, window);
	}, [items, query, band, sort, window]);

	const pinned = useMemo(() => {
		const byId = new Map(allItems.map((item) => [item.id, item]));
		const found = pinnedIds.flatMap((id) => byId.get(id) ?? []);
		return {
			rows: sortMarketItems(found, sort.key, sort.descending, window),
			missing: pinnedIds.length - found.length,
		};
	}, [allItems, pinnedIds, sort, window]);
	const pinnedSet = useMemo(() => new Set(pinnedIds), [pinnedIds]);

	const changeSort = (next: SortState) => {
		setSort(next);
		setPage(0);
	};
	const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
	const currentPage = Math.min(page, pageCount - 1);
	const visible = rows.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
	const bandLabel = MOVE_BANDS.find((entry) => entry.id === band)?.label;
	const pager = <Pager page={currentPage} pageCount={pageCount} onChange={setPage} />;
	const tableProps = { window, sort, onSort: changeSort, pinned: pinnedSet, onTogglePin: togglePin };

	return (
		<>
			{pinnedIds.length > 0 && (
				<section className="rounded-lg border border-border bg-card" aria-labelledby="market-pinned-title">
					<header className="border-b border-border p-4">
						<h2 id="market-pinned-title" className="font-semibold text-foreground">
							Pinned items
						</h2>
						<p className="text-xs text-muted-foreground">
							{pinned.rows.length.toLocaleString("en-US")} pinned in this profile, shown regardless of filters
							{pinned.missing > 0 &&
								` · ${pinned.missing} pinned item${pinned.missing === 1 ? " has" : "s have"} no market data in this mode`}
						</p>
					</header>
					<MarketTable {...tableProps} rows={pinned.rows} empty="No pinned items have market data in this mode." />
				</section>
			)}

			<section className="rounded-lg border border-border bg-card" aria-labelledby="market-explorer-title">
				<header className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h2 id="market-explorer-title" className="font-semibold text-foreground">
							All items
						</h2>
						<p className="text-xs text-muted-foreground">
							{rows.length.toLocaleString("en-US")} items · {window} change · dot marks the current price in its 7-day
							range, tick the 7-day median
						</p>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						{bandLabel && (
							<button
								type="button"
								onClick={onClearBand}
								className="inline-flex items-center gap-1 rounded-full border border-brand/40 bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand hover:bg-brand/20"
							>
								{window} {bandLabel}
								<X className="size-3" aria-label="Clear change filter" />
							</button>
						)}
						{pageCount > 1 && pager}
						<label className="relative">
							<span className="sr-only">Search items</span>
							<Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
							<input
								type="search"
								value={search}
								onChange={(event) => {
									setSearch(event.target.value);
									setPage(0);
								}}
								placeholder="Search items"
								autoComplete="off"
								className="h-9 w-56 rounded-md border border-border bg-background pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand focus:outline-none"
							/>
						</label>
					</div>
				</header>
				<MarketTable {...tableProps} rows={visible} empty="No items match these filters." />
				{pageCount > 1 && <footer className="flex justify-end border-t border-border px-4 py-2">{pager}</footer>}
			</section>
		</>
	);
}

interface MarketTableProps {
	rows: MarketOverviewItem[];
	window: MarketWindow;
	sort: SortState;
	onSort: (sort: SortState) => void;
	pinned: ReadonlySet<string>;
	onTogglePin: (itemId: string) => void;
	empty: string;
}

function MarketTable({ rows, window, sort, onSort, pinned, onTogglePin, empty }: MarketTableProps) {
	const header = (key: ExplorerSortKey, label: string, align: "left" | "right" = "right") => {
		const active = sort.key === key;
		return (
			<th
				scope="col"
				className={cn("px-3 py-2 font-medium", align === "right" && "text-right")}
				aria-sort={active ? (sort.descending ? "descending" : "ascending") : "none"}
			>
				<button
					type="button"
					onClick={() => onSort({ key, descending: active ? !sort.descending : key !== "name" })}
					className={cn(
						"inline-flex items-center gap-1 whitespace-nowrap hover:text-foreground",
						active && "text-foreground",
					)}
				>
					{label}
					{active && (sort.descending ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
				</button>
			</th>
		);
	};

	return (
		<div className="overflow-x-auto">
			<table className="w-full text-sm">
				<thead className="text-left text-xs text-muted-foreground">
					<tr>
						{header("name", "Item", "left")}
						{header("price", "Price")}
						<th scope="col" className="px-3 py-2 font-medium">
							Last ~24h
						</th>
						{header("change", window)}
						{header("changeRub", `${window} ₽`)}
						{header("range", "7d range", "left")}
						{header("percentile", "30d position")}
						{header("volatility", "Volatility")}
						<th scope="col" className="px-3 py-2 font-medium">
							Trend
						</th>
						{header("offers", "Offers")}
						<th scope="col" className="w-10 px-3 py-2">
							<span className="sr-only">Pin</span>
						</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((item) => {
						const change = changeOf(item, window);
						const rub = changeRubOf(item, window);
						const isPinned = pinned.has(item.id);
						return (
							<tr key={item.id} className="border-t border-border hover:bg-highlight/5">
								<td className="px-3 py-1.5">
									<div className="flex min-w-48 items-center gap-2">
										<ItemImage item={toPreviewItem(item)} size="sm" opensModal />
										<div className="min-w-0">
											<ItemLink
												item={toPreviewItem(item)}
												className="block truncate text-left font-medium text-foreground hover:text-brand"
											>
												{item.name}
											</ItemLink>
											<span className="block truncate text-xs text-muted-foreground">
												{item.category ?? EMPTY}
												{item.confidence === "low" && " · low confidence"}
											</span>
										</div>
									</div>
								</td>
								<td className="px-3 py-1.5 text-right whitespace-nowrap tabular-nums">
									{formatPrice(currentPrice(item))}
								</td>
								<td className="px-3 py-1.5">
									<Sparkline sparkline={item.sparkline} width={80} height={24} />
								</td>
								<td className={cn("px-3 py-1.5 text-right tabular-nums", changeTone(change))}>
									{formatPercent(change)}
								</td>
								<td className={cn("px-3 py-1.5 text-right whitespace-nowrap tabular-nums", changeTone(rub))}>
									{formatSignedRoubles(rub)}
								</td>
								<td className="px-3 py-1.5">
									<RangeBar item={item} />
								</td>
								<td className="px-3 py-1.5 text-right tabular-nums">
									{item.percentile30d === null ? EMPTY : `${Math.round(item.percentile30d * 100)}th`}
								</td>
								<td className="px-3 py-1.5 text-right tabular-nums">
									{formatPercent(item.volatility7d, { signed: false })}
								</td>
								<td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">{TREND_LABEL[item.trend]}</td>
								<td className="px-3 py-1.5 text-right tabular-nums">{item.liveOfferCount ?? EMPTY}</td>
								<td className="px-3 py-1.5 text-right">
									<button
										type="button"
										onClick={() => onTogglePin(item.id)}
										aria-pressed={isPinned}
										aria-label={`${isPinned ? "Unpin" : "Pin"} ${item.name}`}
										title={isPinned ? "Unpin" : "Pin"}
										className={cn(
											"rounded p-1 transition-colors hover:bg-highlight/10 focus-visible:outline-2 focus-visible:outline-brand",
											isPinned ? "text-brand" : "text-muted-foreground/60 hover:text-foreground",
										)}
									>
										<Pin className={cn("size-4", isPinned && "fill-current")} />
									</button>
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
			{!rows.length && <p className="p-6 text-center text-sm text-muted-foreground">{empty}</p>}
		</div>
	);
}

function Pager({ page, pageCount, onChange }: { page: number; pageCount: number; onChange: (page: number) => void }) {
	const button = "rounded border border-border p-1 hover:bg-highlight/5 disabled:opacity-40";
	return (
		<nav aria-label="Table pages" className="flex items-center gap-2 text-xs text-muted-foreground">
			<span className="tabular-nums">
				Page {page + 1} of {pageCount}
			</span>
			<button
				type="button"
				onClick={() => onChange(page - 1)}
				disabled={page === 0}
				aria-label="Previous page"
				className={button}
			>
				<ChevronLeft className="size-4" />
			</button>
			<button
				type="button"
				onClick={() => onChange(page + 1)}
				disabled={page >= pageCount - 1}
				aria-label="Next page"
				className={button}
			>
				<ChevronRight className="size-4" />
			</button>
		</nav>
	);
}
