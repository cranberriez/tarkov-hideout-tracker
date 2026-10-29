"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import type { ItemSummary } from "@/types/items";
import { ItemImage } from "@/components/entities/item-image";
import { cn } from "@/lib/utils";
import { summarizeReview, type ReviewEntry } from "./review-model";
import { foundInRaidLabel } from "./found-in-raid";
import { sectionLabel } from "./UploaderSidebarHeader";
import { UploaderItemSearch, useItemSearch } from "./UploaderItemSearch";
import type { ItemGroupKey } from "@/lib/data/item-groups";
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
	group,
	onGroupChange,
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
	group: ItemGroupKey | null;
	onGroupChange: (group: ItemGroupKey | null) => void;
}) {
	const [query, setQuery] = useState("");
	const [showSeenItems, setShowSeenItems] = useState(false);
	const search = useRef<HTMLInputElement>(null);
	const catalog = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
	const matches = useItemSearch({ idPrefix: "missing", items, query, group });
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
								<ItemImage item={item} size={36} aria-label="" />
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
						<UploaderItemSearch
							search={matches}
							query={query}
							onQueryChange={setQuery}
							group={group}
							onGroupChange={onGroupChange}
							onPick={add}
							inputRef={search}
							label="Search missing items"
							placeholder="Type an item name…"
							heading={query.trim() ? "Search matches" : group ? "Category items" : null}
							emptyText="No items found."
						/>
						{added.map((entry) => {
							const item = catalog.get(entry.itemId);
							return (
								<div key={entry.id} className="mt-3 border-t border-border-color pt-3">
									<p className="mb-2 text-xs text-foreground">
										{item?.name ?? `Missing catalog item: ${entry.itemId}`}
									</p>
									<div className="flex items-center gap-2">
										{item && <ItemImage item={item} size={36} aria-label="" />}
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
						<IconsToggle checked={showIcons} onToggle={onToggleIcons} />
					</section>
				)}
			</div>
		</div>
	);
}

/** Draws catalog icons over identified boxes, for checking matches at a glance. */
export function IconsToggle({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
	return (
		<button
			role="switch"
			aria-checked={checked}
			onClick={onToggle}
			className="flex w-full items-center justify-between gap-2 rounded-sm border border-border-color px-3 py-2 text-xs text-foreground hover:bg-surface-raised"
		>
			Show item icons on screenshot
			<span
				className={cn(
					"flex h-4 w-7 shrink-0 rounded-full p-0.5",
					checked ? "justify-end bg-brand" : "justify-start bg-surface-raised",
				)}
			>
				<span className="h-3 w-3 rounded-full bg-foreground" />
			</span>
		</button>
	);
}
