"use client";

/* eslint-disable @next/next/no-img-element -- Catalog previews. */
import { useMemo, useRef, useState } from "react";
import { Check, ArrowRight, X } from "lucide-react";
import type { ItemSummary } from "@/types/items";
import { itemImageUrl } from "@/lib/utils/item-images";
import { cn } from "@/lib/utils";
import { summarizeReview, type ReviewEntry } from "./review-model";
import { foundInRaidLabel } from "./found-in-raid";
import styles from "./UploaderReview.module.css";

type AddedItem = ReviewEntry & { id: number; itemId: string };

export function UploaderCompletion({
	visible,
	boxes,
	items,
	onReview,
	onSummary,
	ignoredCount,
}: {
	visible: boolean;
	boxes: readonly ReviewEntry[];
	items: ItemSummary[];
	onReview: () => void;
	onSummary: (entries: ReviewEntry[]) => void;
	ignoredCount: number;
}) {
	const [added, setAdded] = useState<AddedItem[]>([]);
	const [query, setQuery] = useState("");
	const [showSeenItems, setShowSeenItems] = useState(false);
	const serial = useRef(0);
	const search = useRef<HTMLInputElement>(null);
	const catalog = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
	const results = useMemo(() => {
		const text = query.trim().toLowerCase();
		return text
			? items.filter((item) => `${item.name} ${item.shortName ?? ""}`.toLowerCase().includes(text)).slice(0, 5)
			: [];
	}, [items, query]);
	const summary = useMemo(() => summarizeReview([...boxes, ...added], items), [boxes, added, items]);
	const add = (item: ItemSummary) => {
		const id = ++serial.current;
		setAdded((previous) => [...previous, { id, itemId: item.id, quantity: 1, foundInRaid: "no" }]);
		setQuery("");
		search.current?.focus();
	};
	const patch = (id: number, update: Partial<ReviewEntry>) =>
		setAdded((previous) =>
			previous.map((entry) => (entry.id === id ? { ...entry, ...update, itemId: entry.itemId } : entry)),
		);
	if (!visible) return null;
	return (
		<div className="pt-4">
			<div role="status" className={cn("border-b border-border-color pb-4", styles.complete)}>
				<h2 className="flex items-center gap-2 text-sm font-semibold text-success">
					<Check size={18} aria-hidden="true" />
					{ignoredCount ? "Ready to continue" : "All items classified"}
				</h2>
				{ignoredCount > 0 && (
					<p className="mt-2 text-xs text-warning">
						{ignoredCount} unknown {ignoredCount === 1 ? "item excluded" : "items excluded"}. You can return to review
						them.
					</p>
				)}
			</div>
			<div className={styles.nextStep}>
				{showSeenItems ? (
					<section className="border-b border-border-color py-4" aria-label="Item list">
						<h3 className="mb-3 text-sm font-semibold text-foreground">Item list</h3>
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
						<p className="mt-3 text-xs text-muted-foreground">
							This review stays on this page. Inventory is unchanged.
						</p>
						<button
							onClick={() => setShowSeenItems(false)}
							className="mt-3 w-full rounded-md border border-border-color px-3 py-2 text-sm text-foreground hover:bg-surface-raised"
						>
							Back to review options
						</button>
					</section>
				) : (
					<>
						<section className="py-4" aria-label="Missing items">
							<h3 className="text-sm font-semibold text-foreground">Any missing items?</h3>
							<p className="mb-3 mt-1 text-xs text-muted-foreground">Add anything the scan missed.</p>
							<input
								ref={search}
								aria-label="Search missing items"
								type="search"
								placeholder="Search items to add…"
								value={query}
								onChange={(event) => setQuery(event.target.value)}
								onKeyDown={(event) => {
									if (event.key === "Enter" && !event.nativeEvent.isComposing && results[0]) {
										event.preventDefault();
										add(results[0]);
									}
								}}
								className="w-full rounded-md border border-border-color bg-surface-raised px-3 py-2 text-sm text-foreground"
							/>
							{query.trim() && (
								<div aria-label="Missing item matches" className="my-2">
									{results.map((item) => (
										<button
											key={item.id}
											onClick={() => add(item)}
											className="flex w-full items-center gap-2 py-2 text-left text-xs text-foreground hover:bg-surface-raised"
										>
											<img src={itemImageUrl(item)} alt="" className="h-7 w-7 object-contain" />
											{item.name}
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
														patch(entry.id, { quantity });
													else event.target.value = String(entry.quantity);
												}}
												className="min-w-0 w-16 rounded border border-border-color bg-surface-raised px-2 py-1.5 text-sm text-foreground"
											/>
											<button
												role="switch"
												aria-checked={entry.foundInRaid === "yes"}
												aria-label={`Found in raid for ${item?.name ?? entry.itemId}`}
												onClick={() => patch(entry.id, { foundInRaid: entry.foundInRaid === "yes" ? "no" : "yes" })}
												className={cn(
													"flex items-center gap-1.5 rounded-md border border-border-color px-2 py-1.5 text-xs",
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
												onClick={() => setAdded((previous) => previous.filter((item) => item.id !== entry.id))}
												className="ml-auto p-1 text-muted-foreground hover:text-danger"
											>
												<X size={14} />
											</button>
										</div>
									</div>
								);
							})}
						</section>
						<section className="space-y-2 border-t border-border-color py-4" aria-label="Next step">
							<button
								disabled={summary.unresolved > 0 || summary.totals.length === 0}
								onClick={() => onSummary([...boxes, ...added])}
								className="flex w-full items-center justify-between rounded-md border border-brand bg-brand px-3 py-2.5 text-sm font-semibold text-inverse hover:bg-brand-hover disabled:opacity-40"
							>
								Show summary <ArrowRight size={16} aria-hidden="true" />
							</button>
							<button
								onClick={onReview}
								className="w-full rounded-md border border-border-color px-3 py-2 text-xs text-muted-foreground hover:bg-surface-raised"
							>
								Keep reviewing
							</button>
							<button
								onClick={() => setShowSeenItems(true)}
								className="w-full py-1 text-center text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
							>
								View item list
							</button>
						</section>
					</>
				)}
			</div>
		</div>
	);
}
