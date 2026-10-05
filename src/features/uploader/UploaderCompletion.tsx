"use client";

/* eslint-disable @next/next/no-img-element -- Catalog previews. */
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import type { ItemSummary } from "@/types/items";
import { itemImageUrl } from "@/lib/utils/item-images";
import { cn } from "@/lib/utils";
import { summarizeReview, type ReviewEntry } from "./review-model";
import { foundInRaidLabel } from "./found-in-raid";
import { KeyHint, sectionLabel } from "./UploaderSidebarHeader";
import styles from "./UploaderReview.module.css";

export type AddedItem = ReviewEntry & { id: number; itemId: string };

/** Missing-item entry after classification; the review owns additions and step navigation. */
export function UploaderCompletion({
	boxes,
	items,
	added,
	onAdd,
	onPatch,
	onRemove,
	firUnknown,
	onSetFir,
	showIcons,
	onToggleIcons,
}: {
	boxes: readonly ReviewEntry[];
	items: ItemSummary[];
	added: readonly AddedItem[];
	onAdd: (item: ItemSummary) => void;
	onPatch: (id: number, update: Partial<ReviewEntry>) => void;
	onRemove: (id: number) => void;
	firUnknown: number;
	onSetFir: () => void;
	/** Catalog icons drawn over identified boxes, for checking matches at a glance. */
	showIcons: boolean;
	onToggleIcons: () => void;
}) {
	const [query, setQuery] = useState("");
	const [highlight, setHighlight] = useState({ query: "", index: 0 });
	const [showSeenItems, setShowSeenItems] = useState(false);
	const search = useRef<HTMLInputElement>(null);
	const catalog = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
	const results = useMemo(() => {
		const text = query.trim().toLowerCase();
		return text
			? items.filter((item) => `${item.name} ${item.shortName ?? ""}`.toLowerCase().includes(text)).slice(0, 5)
			: [];
	}, [items, query]);
	const highlighted = highlight.query === query ? Math.min(highlight.index, results.length - 1) : 0;
	useEffect(() => search.current?.focus({ preventScroll: true }), []);
	const summary = useMemo(() => summarizeReview([...boxes, ...added], items), [boxes, added, items]);
	const add = (item: ItemSummary) => {
		onAdd(item);
		setQuery("");
		search.current?.focus();
	};
	return (
		<div className="flex flex-1 flex-col pt-4">
			<p role="status" className={cn("flex items-center gap-2 text-sm font-semibold text-success", styles.complete)}>
				<Check size={16} aria-hidden="true" />
				Review done
			</p>
			<div className={cn("flex flex-1 flex-col", styles.nextStep)}>
				{firUnknown > 0 && (
					<section className="flex items-center justify-between gap-3 border-b border-border-color py-3">
						<p className="text-xs text-muted-foreground">
							<span className="font-semibold text-fir">{firUnknown}</span> without a FIR choice
						</p>
						<button
							onClick={onSetFir}
							className="shrink-0 rounded-sm border border-fir/40 bg-fir/10 px-3 py-1.5 text-xs font-semibold text-fir hover:bg-fir/20"
						>
							Set FIR
						</button>
					</section>
				)}
				{showSeenItems ? (
					<section className="border-b border-border-color py-4" aria-label="Item list">
						<div className="mb-3 flex items-center justify-between gap-2">
							<h3 className={sectionLabel}>Item list</h3>
							<button
								onClick={() => setShowSeenItems(false)}
								className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
							>
								Close item list
							</button>
						</div>
						{!summary.totals.length && (
							<p className="text-xs text-muted-foreground">
								No identified items yet. Add missing items or keep reviewing.
							</p>
						)}
						{summary.unresolved > 0 && (
							<p role="alert" className="text-sm text-danger">
								Some items are missing from the catalog or have invalid quantities. Return to review to correct them.
							</p>
						)}
						{summary.totals.map(({ item, quantity, foundInRaid }) => (
							<div
								key={`${item.id}:${foundInRaid}`}
								className="flex items-center gap-2 border-b border-border-color/50 py-2 last:border-0"
							>
								<img src={itemImageUrl(item)} alt="" className="h-9 w-9 object-contain" />
								<div className="min-w-0 flex-1">
									<p className="text-xs text-foreground">{item.name}</p>
									<p className="text-[10px] text-muted-foreground">{foundInRaidLabel(foundInRaid)}</p>
								</div>
								<span className="text-sm tabular-nums text-foreground">×{quantity}</span>
							</div>
						))}
					</section>
				) : (
					<section className="flex flex-1 flex-col py-4" aria-label="Missing items">
						<h3 className={sectionLabel}>Add missing items</h3>
						<p className="mb-2 mt-1 text-xs leading-relaxed text-muted-foreground">
							Look for items on the screenshot that aren&apos;t darkened, even partly. The scan likely missed them, so
							add them here.
						</p>
						<input
							ref={search}
							aria-label="Search missing items"
							type="search"
							placeholder="Type an item name…"
							autoComplete="off"
							aria-controls="missing-matches"
							aria-activedescendant={results[highlighted] ? `missing-match-${results[highlighted].id}` : undefined}
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							onKeyDown={(event) => {
								if (event.nativeEvent.isComposing) return;
								if ((event.key === "ArrowDown" || event.key === "ArrowUp") && results.length) {
									event.preventDefault();
									const step = event.key === "ArrowDown" ? 1 : -1;
									setHighlight({ query, index: (highlighted + step + results.length) % results.length });
								} else if (event.key === "Enter" && results[highlighted]) {
									event.preventDefault();
									add(results[highlighted]);
								}
							}}
							className="w-full rounded-sm border border-border-color bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-brand"
						/>
						{query.trim() && (
							<div id="missing-matches" role="listbox" aria-label="Missing item matches" className="my-2 space-y-1">
								{results.map((item, rank) => (
									<button
										key={item.id}
										id={`missing-match-${item.id}`}
										role="option"
										aria-selected={rank === highlighted}
										onClick={() => add(item)}
										onMouseEnter={() => setHighlight({ query, index: rank })}
										className={cn(
											"flex w-full items-center gap-2 rounded-sm border px-2 py-1.5 text-left text-xs text-foreground",
											rank === highlighted
												? "border-brand/60 bg-brand/10"
												: "border-transparent hover:bg-surface-raised",
										)}
									>
										<img src={itemImageUrl(item)} alt="" className="h-7 w-7 object-contain" />
										<span className="flex-1">{item.name}</span>
										{rank === highlighted && <KeyHint>↵</KeyHint>}
									</button>
								))}
								{!results.length && <p className="py-2 text-xs text-muted-foreground">No items found.</p>}
							</div>
						)}
						{added.map((entry) => {
							const item = catalog.get(entry.itemId);
							return (
								<div key={entry.id} className="mt-3 border-t border-border-color pt-3">
									<p className="mb-2 text-xs text-foreground">
										{item?.name ?? `Missing catalog item: ${entry.itemId}`}
									</p>
									<div className="flex items-center gap-2">
										{item && <img src={itemImageUrl(item)} alt="" className="h-9 w-9 object-contain" />}
										<input
											key={`${entry.id}:${entry.quantity}`}
											aria-label={`Quantity for ${item?.name ?? entry.itemId}`}
											type="number"
											min={1}
											max={999999}
											defaultValue={entry.quantity}
											onBlur={(event) => {
												const quantity = Number(event.target.value);
												if (Number.isSafeInteger(quantity) && quantity > 0 && quantity <= 999999)
													onPatch(entry.id, { quantity });
												else event.target.value = String(entry.quantity);
											}}
											className="min-w-0 w-16 rounded border border-border-color bg-surface-raised px-2 py-1.5 text-sm text-foreground"
										/>
										<button
											role="switch"
											aria-checked={entry.foundInRaid === "yes"}
											aria-label={`Found in raid for ${item?.name ?? entry.itemId}`}
											onClick={() => onPatch(entry.id, { foundInRaid: entry.foundInRaid === "yes" ? "no" : "yes" })}
											className={cn(
												"flex items-center gap-1.5 rounded-sm border border-border-color px-2 py-1.5 text-xs",
												entry.foundInRaid === "yes" ? "text-fir bg-fir/10" : "text-muted-foreground",
											)}
										>
											<span
												className={cn(
													"flex h-4 w-7 rounded-full p-0.5",
													entry.foundInRaid === "yes" ? "justify-end bg-fir" : "justify-start bg-surface-raised",
												)}
											>
												<span className="h-3 w-3 rounded-full bg-foreground" />
											</span>
											FIR
										</button>
										<button
											aria-label={`Remove added ${item?.name ?? entry.itemId}`}
											onClick={() => onRemove(entry.id)}
											className="ml-auto p-1 text-muted-foreground hover:text-danger"
										>
											<X size={14} />
										</button>
									</div>
								</div>
							);
						})}
						<button
							onClick={() => setShowSeenItems(true)}
							className="mt-4 w-full py-1 text-center text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
						>
							View item list
						</button>
						<div className="min-h-3 flex-1" />
						<button
							role="switch"
							aria-checked={showIcons}
							onClick={onToggleIcons}
							className="flex w-full items-center justify-between gap-2 rounded-sm border border-border-color px-3 py-2 text-xs text-foreground hover:bg-surface-raised"
						>
							Show item icons on screenshot
							<span
								className={cn(
									"flex h-4 w-7 shrink-0 rounded-full p-0.5",
									showIcons ? "justify-end bg-brand" : "justify-start bg-surface-raised",
								)}
							>
								<span className="h-3 w-3 rounded-full bg-foreground" />
							</span>
						</button>
					</section>
				)}
			</div>
		</div>
	);
}
