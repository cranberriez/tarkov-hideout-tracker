"use client";

import { useMemo, useState } from "react";
import { PackageOpen, Plus, Search, X } from "lucide-react";
import { DataLoadError, DataQueryRetryProvider } from "@/components/core/DataLoadError";
import { RouteLoader } from "@/components/core/RouteLoader";
import { toTarkovJsonGameMode, type TarkovJsonGameMode } from "@/lib/game-mode";
import { useUserStoreHydrated } from "@/lib/query/game-data";
import { useSearchManifest } from "@/lib/search/useSearchManifest";
import { useUIStore } from "@/lib/stores/useUIStore";
import { useUserStore } from "@/lib/stores/useUserStore";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/utils/format-number";
import type { ItemSummary } from "@/types/items";
import { buildInventoryRows, filterAndSortInventoryRows, type InventorySort } from "./inventory-model";
import { InventoryRow } from "./InventoryRow";

export function InventoryClientPage() {
	const hydrated = useUserStoreHydrated();
	const gameMode = useUserStore((state) => state.gameMode);
	if (!hydrated) return <RouteLoader page="items" title="Inventory" />;
	// Keyed by mode so rows kept at zero belong to one profile's visit.
	return <InventoryView key={gameMode} mode={toTarkovJsonGameMode(gameMode)} />;
}

function InventoryView({ mode }: { mode: TarkovJsonGameMode }) {
	const manifest = useSearchManifest(mode, true);
	const itemCounts = useUserStore((state) => state.itemCounts);
	const addItemCounts = useUserStore((state) => state.addItemCounts);
	const openItemDetail = useUIStore((state) => state.openItemDetail);
	const setQuickAddOpen = useUIStore((state) => state.setQuickAddOpen);
	const [keptIds, setKeptIds] = useState<ReadonlySet<string>>(() => new Set());
	const [query, setQuery] = useState("");
	const [sort, setSort] = useState<InventorySort>("name");
	const [orderCounts, setOrderCounts] = useState(itemCounts);

	const itemsById = useMemo(
		() => new Map<string, ItemSummary>((manifest.data?.items ?? []).map((item) => [item.id, item])),
		[manifest.data],
	);
	const rows = useMemo(() => buildInventoryRows(itemCounts, keptIds, itemsById), [itemCounts, keptIds, itemsById]);
	const visibleRows = useMemo(
		() => filterAndSortInventoryRows(rows, query, sort, orderCounts),
		[rows, query, sort, orderCounts],
	);
	const totalCount = rows.reduce((sum, row) => sum + row.fir + row.nonFir, 0);

	const setCount = (itemId: string, key: "fir" | "nonFir", value: number) => {
		const current = itemCounts[itemId] ?? { have: 0, haveFir: 0 };
		const delta = value - (key === "fir" ? current.haveFir : current.have);
		if (!delta) return;
		if (!keptIds.has(itemId)) setKeptIds(new Set(keptIds).add(itemId));
		addItemCounts(itemId, key === "fir" ? 0 : delta, key === "fir" ? delta : 0);
	};

	if (!manifest.data && !manifest.error) return <RouteLoader page="items" title="Inventory" />;

	return (
		<main className="container mx-auto px-6 py-8">
			<div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight text-foreground">INVENTORY</h1>
					{manifest.data && rows.length > 0 && (
						<p className="mt-1 text-sm text-muted-foreground">
							{formatNumber(rows.length)} item{rows.length !== 1 ? "s" : ""} · {formatNumber(totalCount)} total
						</p>
					)}
				</div>
				<button
					type="button"
					onClick={() => setQuickAddOpen(true)}
					className="inline-flex items-center gap-2 self-start rounded bg-brand px-3 py-2 text-sm font-semibold text-inverse hover:bg-brand-hover sm:self-auto"
				>
					<Plus size={16} />
					Add items
				</button>
			</div>

			{!manifest.data ? (
				<DataQueryRetryProvider retry={() => void manifest.retry()}>
					<DataLoadError
						title="Item data is unavailable"
						messages={[manifest.error?.message ?? "Item data could not be loaded."]}
					/>
				</DataQueryRetryProvider>
			) : rows.length === 0 ? (
				<div className="rounded-md border border-dashed border-highlight/20 px-6 py-12 text-center">
					<PackageOpen size={28} className="mx-auto text-muted-foreground" aria-hidden="true" />
					<p className="mt-3 font-medium text-foreground">Your inventory is empty</p>
					<p className="mt-1 text-sm text-muted-foreground">Items you add from raids will show up here.</p>
				</div>
			) : (
				<>
					<div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
						<div className="flex h-10 flex-1 items-center gap-2 rounded-md border border-highlight/10 bg-shadow/40 px-3 focus-within:border-brand/50">
							<Search size={16} className="text-muted-foreground" aria-hidden="true" />
							<input
								type="text"
								aria-label="Filter inventory"
								placeholder="Filter inventory…"
								value={query}
								onChange={(event) => setQuery(event.target.value)}
								className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
							/>
							{query && (
								<button
									type="button"
									aria-label="Clear filter"
									onClick={() => setQuery("")}
									className="text-muted-foreground hover:text-foreground"
								>
									<X size={16} />
								</button>
							)}
						</div>
						<div
							role="radiogroup"
							aria-label="Sort inventory"
							className="flex rounded-md border border-highlight/10 p-0.5 text-xs"
						>
							{(
								[
									["name", "Name"],
									["total", "Count"],
								] as const
							).map(([value, label]) => (
								<button
									key={value}
									type="button"
									role="radio"
									aria-checked={sort === value}
									onClick={() => {
										setSort(value);
										setOrderCounts(itemCounts);
									}}
									className={cn(
										"rounded px-3 py-1.5 font-medium",
										sort === value ? "bg-brand text-inverse" : "text-muted-foreground hover:text-foreground",
									)}
								>
									{label}
								</button>
							))}
						</div>
					</div>

					{visibleRows.length === 0 ? (
						<p role="status" className="px-6 py-10 text-center text-sm text-muted-foreground">
							No inventory items match “{query}”.
						</p>
					) : (
						<ul className="space-y-2">
							{visibleRows.map(({ item, ...row }) => (
								<InventoryRow
									key={row.id}
									row={{ item, ...row }}
									onSetCount={(key, value) => setCount(row.id, key, value)}
									onOpenItem={item ? () => openItemDetail(item) : undefined}
								/>
							))}
						</ul>
					)}
				</>
			)}
		</main>
	);
}
