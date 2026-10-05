"use client";

/* eslint-disable @next/next/no-img-element -- Local screenshot crops and catalog previews. */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ItemSummary } from "@/types/items";
import type { ReviewEntry } from "./review-model";
import { UploaderSummary } from "./UploaderSummary";
import { itemImageUrl } from "@/lib/utils/item-images";
import { cn } from "@/lib/utils";
import type { Screenshot } from "./image-recognition";
import { suggestLabelCandidates } from "./label-suggestions";
import { buildLabelIndex, type ItemDetection } from "./recognition-model";
import { seedReviewBoxes, suggestReviewGrid, type ReviewBox } from "./review-model";
import { nextUnknownId, selectReviewBoxes, selectionSuggestions, supportsQuantity } from "./selection-model";
import styles from "./UploaderReview.module.css";
import { ArrowLeft, Undo2 } from "lucide-react";
import { UploaderCompletion } from "./UploaderCompletion";

const control =
	"flex items-center justify-between gap-2 rounded-md border border-border-color bg-surface-raised px-3 py-2.5 text-sm text-foreground transition-colors hover:border-brand/50 hover:bg-brand/15 disabled:opacity-40";
export function KeyHint({ children }: { children: ReactNode }) {
	return (
		<kbd className="inline-flex min-h-5 min-w-5 items-center justify-center rounded border border-b-2 border-border-color bg-background px-1.5 font-mono text-[10px] leading-4 text-muted-foreground shadow-sm">
			{children}
		</kbd>
	);
}

export function UploaderReview({
	image,
	detections,
	items,
	imageActions,
	bottomBar,
}: {
	image: Screenshot;
	detections: ItemDetection[];
	items: ItemSummary[];
	imageActions: ReactNode;
	bottomBar: ReactNode;
}) {
	const grid = useMemo(
		() => suggestReviewGrid(detections, image.width, image.height),
		[detections, image.width, image.height],
	);
	const [history, setHistory] = useState<ReviewBox[][]>(() => [seedReviewBoxes(detections, grid, items)]);
	const boxes = history[history.length - 1];
	const [selected, setSelected] = useState<string[]>([]);
	const anchor = useRef<string | null>(null);
	const canvas = useRef<HTMLDivElement>(null);
	const [fitWidth, setFitWidth] = useState(0);
	useEffect(() => {
		const element = canvas.current;
		if (!element) return;
		const observer = new ResizeObserver(([entry]) => {
			setFitWidth(
				Math.max(0, Math.min(entry.contentRect.width, (entry.contentRect.height * image.width) / image.height)),
			);
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, [image.width, image.height]);
	const [zoom, setZoom] = useState(100);
	const [query, setQuery] = useState("");
	const [keepReviewing, setKeepReviewing] = useState(false);
	const [ignoreUnknowns, setIgnoreUnknowns] = useState(false);
	const [summaryOpen, setSummaryOpen] = useState(false);
	const [summaryEntries, setSummaryEntries] = useState<ReviewEntry[]>([]);
	const summaryBack = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		if (summaryOpen) summaryBack.current?.focus();
	}, [summaryOpen]);
	const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
	const chosen = useMemo(() => boxes.filter((box) => selected.includes(box.id)), [boxes, selected]);
	const active = chosen[0];
	const activeItem = active?.itemId ? byId.get(active.itemId) : undefined;
	const index = useMemo(() => buildLabelIndex(items), [items]);
	const suggestions = useMemo(() => {
		if (!query.trim()) return selectionSuggestions(chosen, items);
		const text = query.trim().toLowerCase();
		const matches = items.filter((item) => `${item.name} ${item.shortName ?? ""}`.toLowerCase().includes(text));
		return [
			...new Map([...matches, ...suggestLabelCandidates(query, index)].map((item) => [item.id, item])).values(),
		].slice(0, 5);
	}, [query, chosen, items, index]);
	const unknowns = boxes.filter((box) => !box.itemId || !byId.has(box.itemId));
	const classified = boxes.length > 0 && unknowns.length === 0;
	const completing = (classified || ignoreUnknowns) && !keepReviewing;
	const included = ignoreUnknowns ? boxes.filter((box) => box.itemId && byId.has(box.itemId)) : boxes;
	const focusBox = (id: string) => {
		setSelected([id]);
		anchor.current = id;
		canvas.current
			?.querySelector<HTMLButtonElement>(`[data-box-index="${boxes.findIndex((box) => box.id === id)}"]`)
			?.scrollIntoView({ block: "nearest", inline: "nearest" });
		canvas.current?.focus({ preventScroll: true });
	};
	const patch = (update: Partial<ReviewBox>) =>
		setHistory((previous) => [
			...previous.slice(-29),
			previous[previous.length - 1].map((box) => (selected.includes(box.id) ? { ...box, ...update } : box)),
		]);
	const assign = (item: ItemSummary, advance = false) => {
		if (!chosen.length) return;
		setHistory((previous) => [
			...previous.slice(-29),
			previous[previous.length - 1].map((box) =>
				selected.includes(box.id)
					? { ...box, itemId: item.id, confirmed: true, quantity: supportsQuantity(item) ? box.quantity : 1 }
					: box,
			),
		]);
		setQuery("");
		setKeepReviewing(false);
		if (advance) {
			const next = nextUnknownId(
				boxes.map((box) => box.id),
				unknowns.filter((box) => !selected.includes(box.id)).map((box) => box.id),
				anchor.current,
			);
			if (next) focusBox(next);
			else setSelected([]);
		}
	};
	const navigateUnknown = (direction: 1 | -1) => {
		if (!unknowns.length) return;
		const next = nextUnknownId(
			boxes.map((box) => box.id),
			unknowns.map((box) => box.id),
			anchor.current,
			direction,
		);
		if (next) focusBox(next);
		setQuery("");
	};
	const nextUnknown = () => navigateUnknown(1);
	const allFir = chosen.length > 0 && chosen.every((box) => box.foundInRaid === "yes");
	const firStatus = chosen.every((box) => box.foundInRaid === active?.foundInRaid) ? active?.foundInRaid : "mixed";
	const toggleFir = () => {
		if (chosen.length) patch({ foundInRaid: allFir ? "no" : "yes", firConfirmed: true });
	};
	useEffect(() => {
		const keydown = (event: KeyboardEvent) => {
			if (completing || summaryOpen) return;
			if (
				event.defaultPrevented ||
				event.repeat ||
				event.isComposing ||
				event.ctrlKey ||
				event.metaKey ||
				event.altKey ||
				event.shiftKey
			)
				return;
			const target = event.target as HTMLElement;
			if (target.closest("input, textarea, select, [contenteditable=true], [role=dialog]")) return;
			if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
				event.preventDefault();
				navigateUnknown(event.key === "ArrowRight" ? 1 : -1);
			} else if (event.key.toLowerCase() === "f") {
				event.preventDefault();
				toggleFir();
			} else if (event.key === "Enter" && !target.closest("button, a") && suggestions[0]) {
				event.preventDefault();
				assign(suggestions[0], true);
			}
		};
		window.addEventListener("keydown", keydown);
		return () => window.removeEventListener("keydown", keydown);
	});
	return (
		<section
			className="relative grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] grid-cols-[minmax(0,1fr)_20rem] overflow-hidden max-sm:grid-cols-[minmax(0,1fr)_15rem]"
			aria-label="Review scanned items"
		>
			<div
				inert={summaryOpen}
				aria-hidden={summaryOpen}
				ref={canvas}
				tabIndex={-1}
				className="min-h-0 overflow-auto bg-shadow/30 p-3 outline-none"
			>
				<div
					role="group"
					aria-label="Screenshot review canvas"
					className="relative isolate mx-auto select-none"
					style={{ width: (fitWidth * zoom) / 100 }}
				>
					<img src={image.url} alt="Uploaded stash screenshot" draggable={false} className="block h-auto w-full" />
					{boxes.map((box, number) => {
						const item = box.itemId ? byId.get(box.itemId) : undefined;
						const picked = selected.includes(box.id);
						return (
							<button
								key={box.id}
								type="button"
								data-box-index={number}
								aria-label={`Box ${number + 1}: ${item?.name ?? "Unknown item"}`}
								aria-pressed={picked}
								onClick={(event) => {
									if (item && (event.ctrlKey || event.metaKey || event.shiftKey)) return;
									setKeepReviewing(true);
									setIgnoreUnknowns(false);
									setSelected(
										selectReviewBoxes(
											boxes.map((box) => box.id),
											selected,
											anchor.current,
											box.id,
											event.ctrlKey || event.metaKey,
											event.shiftKey,
											unknowns.map((box) => box.id),
										),
									);
									if (!event.shiftKey || !anchor.current) anchor.current = box.id;
									setQuery("");
									canvas.current?.focus({ preventScroll: true });
								}}
								className={cn(
									"absolute cursor-pointer border text-left focus-visible:outline-2 focus-visible:outline-foreground",
									item
										? "border-transparent bg-shadow/65 hover:bg-shadow/40"
										: "border-warning/80 bg-warning/20 hover:bg-warning/30",
									picked && "z-10 bg-brand/25 ring-2 ring-foreground",
								)}
								style={{
									left: `${box.bounds.left * 100}%`,
									top: `${box.bounds.top * 100}%`,
									width: `${box.bounds.width * 100}%`,
									height: `${box.bounds.height * 100}%`,
								}}
							>
								<span
									aria-hidden="true"
									className={cn(
										"pointer-events-none absolute inset-0",
										styles.reveal,
										item ? "bg-success/80" : "bg-warning/80",
									)}
									style={{ animationDelay: `${number * Math.min(65, 1800 / Math.max(1, boxes.length))}ms` }}
								/>
								<span className="absolute left-0 top-0 bg-card/90 px-1 text-[10px] leading-tight text-foreground">
									{number + 1}
									{!item ? " ?" : box.confirmed ? " ✓" : ""}
								</span>
							</button>
						);
					})}
				</div>
			</div>
			<aside
				inert={summaryOpen}
				aria-hidden={summaryOpen}
				className="col-start-2 row-start-1 row-span-2 flex min-h-0 flex-col overflow-hidden border-l border-border-color bg-card p-4"
			>
				<div className="-mx-4 -mt-4 min-h-0 flex-1 overflow-y-auto px-4 pt-4">
					<div className="-mx-4 -mt-4 bg-brand/10 p-4">
						<p className="text-[10px] uppercase tracking-widest text-brand">Current goal</p>
						<h1 className="mt-1 text-lg font-semibold text-foreground">
							{completing ? "Complete your review" : "Classify items"}
						</h1>
						<p className="mt-1 text-xs text-muted-foreground" aria-live="polite">
							{unknowns.length
								? `${unknowns.length} unknown remaining`
								: boxes.length
									? "All items classified"
									: "No items detected — try another image"}
						</p>
					</div>
					<UploaderCompletion
						visible={completing}
						boxes={included}
						items={items}
						ignoredCount={ignoreUnknowns ? unknowns.length : 0}
						onSummary={(entries) => {
							setSummaryEntries(entries);
							setSummaryOpen(true);
						}}
						onReview={() => {
							setKeepReviewing(true);
							setIgnoreUnknowns(false);
						}}
					/>
					<div hidden={completing}>
						<div className="grid gap-2 border-b border-border-color py-4">
							{classified && (
								<button className={cn(control, "border-brand text-brand")} onClick={() => setKeepReviewing(false)}>
									Continue to summary <span aria-hidden="true">→</span>
								</button>
							)}
							<button className={control} disabled={!unknowns.length} onClick={nextUnknown}>
								Next unknown <KeyHint>→</KeyHint>
							</button>
							<button
								className={control}
								disabled={!active || !suggestions.length}
								onClick={() => suggestions[0] && assign(suggestions[0], true)}
							>
								Use suggested item <KeyHint>Enter</KeyHint>
							</button>
							{unknowns.length > 0 && (
								<button
									className="rounded-md border border-border-color px-3 py-2 text-xs text-muted-foreground hover:bg-surface-raised"
									onClick={() => {
										setIgnoreUnknowns(true);
										setKeepReviewing(false);
									}}
								>
									Ignore unknowns and continue
								</button>
							)}
							<button
								disabled={history.length < 2}
								onClick={() => setHistory((previous) => previous.slice(0, -1))}
								className="flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-surface-raised hover:text-foreground disabled:opacity-40"
							>
								<Undo2 size={13} aria-hidden="true" />
								Undo last change
							</button>
						</div>
						{active ? (
							<div className="mt-4 space-y-4">
								<div className="flex items-center gap-3">
									<div
										className="relative shrink-0 overflow-hidden"
										style={{
											width: Math.min(
												72,
												(72 * active.bounds.width * image.width) / (active.bounds.height * image.height),
											),
											aspectRatio: `${active.bounds.width * image.width}/${active.bounds.height * image.height}`,
										}}
									>
										<img
											src={image.url}
											alt="Selected item crop"
											className="absolute max-w-none"
											style={{
												width: `${100 / active.bounds.width}%`,
												left: `${(-active.bounds.left / active.bounds.width) * 100}%`,
												top: `${(-active.bounds.top / active.bounds.height) * 100}%`,
											}}
										/>
									</div>
									<div className="min-w-0">
										<p className="text-xs text-muted-foreground">
											{chosen.length > 1 ? `${chosen.length} items selected` : `Item ${boxes.indexOf(active) + 1}`}
										</p>
										<p className="mt-1 text-sm text-foreground">
											{chosen.length > 1 ? "Assign one type to all selected" : (activeItem?.name ?? "Unknown item")}
										</p>
									</div>
								</div>
								<button
									onClick={toggleFir}
									aria-pressed={allFir}
									aria-keyshortcuts="f"
									className={cn(
										"flex w-full items-center justify-between rounded-md border border-border-color px-3 py-3 text-sm font-semibold",
										allFir ? "bg-fir/20 text-fir" : "bg-surface-raised text-foreground",
									)}
								>
									<span>
										{allFir
											? "✓ Found in raid"
											: firStatus === "no"
												? "Not found in raid"
												: firStatus === "mixed"
													? "FIR · Mixed"
													: "FIR · Unknown"}
									</span>
									<KeyHint>F</KeyHint>
								</button>
								<div>
									<label htmlFor="review-search" className="sr-only">
										Search item matches
									</label>
									<input
										id="review-search"
										type="search"
										placeholder="Search items…"
										value={query}
										onChange={(event) => setQuery(event.target.value)}
										onKeyDown={(event) => {
											if (event.key === "Enter" && !event.nativeEvent.isComposing && suggestions[0]) {
												event.preventDefault();
												assign(suggestions[0], true);
												canvas.current?.focus({ preventScroll: true });
											}
										}}
										className="w-full bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-brand"
									/>
								</div>
								<div aria-label="Suggested items" className="border-t border-border-color pt-4">
									<p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
										{query ? "Search matches" : "Best matches"}
									</p>
									{suggestions.map((item, rank) => (
										<button
											key={item.id}
											onClick={() => assign(item)}
											className="mb-1 flex w-full items-center gap-2 border border-border-color px-2 py-2 text-left text-sm text-foreground hover:bg-surface-raised"
										>
											<img src={itemImageUrl(item)} alt="" className="h-8 w-8 object-contain" />
											<span className="flex-1">{item.name}</span>
											{rank === 0 && <KeyHint>↵</KeyHint>}
										</button>
									))}
									{!suggestions.length && (
										<p className="py-2 text-xs text-muted-foreground">No matches. Try searching by name.</p>
									)}
								</div>
								{chosen.length === 1 && supportsQuantity(activeItem) && (
									<label className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
										Quantity
										<input
											key={`${active.id}:${active.quantity}`}
											aria-label="Item quantity"
											type="number"
											min={1}
											max={999999}
											defaultValue={active.quantity}
											className="w-24 bg-surface-raised px-2 py-1 text-foreground"
											onBlur={(event) => {
												const quantity = Number(event.target.value);
												if (Number.isSafeInteger(quantity) && quantity > 0 && quantity <= 999999) patch({ quantity });
												else event.target.value = String(active.quantity);
											}}
										/>
									</label>
								)}
							</div>
						) : (
							<p className="my-6 text-sm text-muted-foreground">
								Select an item in the screenshot to review its matches.
							</p>
						)}
					</div>
				</div>
				<div className="-mx-4 -mb-4 mt-3 shrink-0 border-t border-border-color bg-surface-raised/40 p-3">
					<div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
						<span className="text-[10px] uppercase tracking-widest">Screenshot</span>
						<label>
							Zoom{" "}
							<select
								aria-label="Screenshot zoom"
								value={zoom}
								onChange={(event) => setZoom(Number(event.target.value))}
								className="rounded border border-border-color bg-surface-raised px-1 py-1 text-xs text-foreground"
							>
								{[50, 75, 100, 150, 200].map((value) => (
									<option key={value} value={value}>
										{value === 100 ? "Fit" : `${value}%`}
									</option>
								))}
							</select>
						</label>
					</div>
					{imageActions}
				</div>
			</aside>
			{bottomBar}
			{summaryOpen && (
				<div
					data-uploader-summary
					className={cn("absolute inset-0 z-20 flex flex-col overflow-y-auto bg-card p-4 sm:p-6", styles.summaryPage)}
				>
					<button
						ref={summaryBack}
						onClick={() => {
							setSummaryOpen(false);
						}}
						className="flex w-fit items-center gap-2 rounded-md border border-border-color px-3 py-2 text-sm text-foreground hover:bg-surface-raised"
					>
						<ArrowLeft size={16} aria-hidden="true" />
						Back to review
					</button>
					<div className={styles.summaryContent}>
						<UploaderSummary
							entries={summaryEntries}
							items={items}
							ignoredCount={ignoreUnknowns ? unknowns.length : 0}
						/>
					</div>
				</div>
			)}
		</section>
	);
}
