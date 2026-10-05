"use client";

/* eslint-disable @next/next/no-img-element -- Local screenshot crops and catalog previews. */
import { useMemo, useRef, useState } from "react";
import type { ItemSummary } from "@/types/items";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { QuickAddSearch } from "@/features/quick-add/QuickAddSearch";
import { itemImageUrl } from "@/lib/utils/item-images";
import { cn } from "@/lib/utils";
import { foundInRaidLabel, type FoundInRaidStatus } from "./found-in-raid";
import type { Screenshot } from "./image-recognition";
import { suggestLabelCandidates } from "./label-suggestions";
import { buildLabelIndex } from "./recognition-model";
import type { ItemDetection } from "./recognition-model";
import {
	finishReview,
	seedReviewBoxes,
	suggestReviewGrid,
	summarizeReview,
	type BoxBounds,
	type ReviewBox,
} from "./review-model";

const control =
	"rounded border border-border-color bg-surface-raised px-3 py-2 text-sm text-foreground disabled:opacity-40";
const position = (b: BoxBounds) => ({
	left: `${b.left * 100}%`,
	top: `${b.top * 100}%`,
	width: `${b.width * 100}%`,
	height: `${b.height * 100}%`,
});

export function UploaderReview({
	image,
	detections,
	items,
	mode,
}: {
	image: Screenshot;
	detections: ItemDetection[];
	items: ItemSummary[];
	mode: TarkovJsonGameMode;
}) {
	const grid = useMemo(
		() => suggestReviewGrid(detections, image.width, image.height),
		[detections, image.width, image.height],
	);
	const [history, setHistory] = useState<ReviewBox[][]>(() => [seedReviewBoxes(detections, grid, items)]);
	const boxes = history[history.length - 1];
	const [selected, setSelected] = useState<string | null>(null);
	const [filled, setFilled] = useState(false);
	const [showSuccesses, setShowSuccesses] = useState(true);
	const [zoom, setZoom] = useState(100);
	const [query, setQuery] = useState("");
	const [reviewedList, setReviewedList] = useState<ReturnType<typeof finishReview>>(null);
	const complete = reviewedList !== null;
	const searchInput = useRef<HTMLInputElement>(null);
	const summary = useMemo(() => summarizeReview(boxes, items), [boxes, items]);
	const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
	const heldTotals =
		reviewedList?.map(({ itemId, quantity, foundInRaid }) => ({
			itemId,
			item: byId.get(itemId),
			quantity,
			foundInRaid,
		})) ?? [];
	const active = boxes.find((box) => box.id === selected);
	const suggestionIndex = useMemo(() => buildLabelIndex(items), [items]);
	const suggestions = query ? suggestLabelCandidates(query, suggestionIndex) : (active?.candidates ?? []);
	const unknowns = boxes.filter((box) => !box.itemId || !byId.has(box.itemId));
	const change = (next: ReviewBox[]) => {
		setHistory((previous) => [...previous.slice(-29), next]);
		setReviewedList(null);
	};
	const patch = (id: string, update: Partial<ReviewBox>) =>
		change(boxes.map((box) => (box.id === id ? { ...box, ...update } : box)));
	const select = (id: string) => {
		setSelected(id);
		setQuery("");
	};
	const assign = (item: ItemSummary) => {
		if (active) patch(active.id, { itemId: item.id, confirmed: true });
		setQuery("");
	};
	const nextUnknown = () => {
		const index = unknowns.findIndex((box) => box.id === selected);
		if (unknowns.length) select(unknowns[(index + 1) % unknowns.length].id);
	};
	return (
		<section aria-label="Review scanned items">
			<div className="flex flex-wrap items-center gap-2 border-b border-border-color p-3">
				{complete ? (
					<button className={control} onClick={() => setReviewedList(null)}>
						Back to editing
					</button>
				) : (
					<>
						<button
							className={control}
							disabled={history.length < 2}
							onClick={() => {
								setHistory((h) => h.slice(0, -1));
							}}
						>
							Undo
						</button>
						<button className={control} disabled={!unknowns.length} onClick={nextUnknown}>
							Next unknown ({unknowns.length})
						</button>
					</>
				)}
				<label className="flex items-center gap-2 text-sm text-muted-foreground">
					<input type="checkbox" checked={filled} onChange={(e) => setFilled(e.target.checked)} />
					Fill boxes
				</label>
				<label className="flex items-center gap-2 text-sm text-muted-foreground">
					<input
						type="checkbox"
						checked={showSuccesses}
						onChange={(e) => {
							setShowSuccesses(e.target.checked);
							setSelected(null);
						}}
					/>
					Show successes
				</label>
				<label className="ml-auto text-xs text-muted-foreground">
					Zoom{" "}
					<select
						aria-label="Screenshot zoom"
						className={control}
						value={zoom}
						onChange={(e) => setZoom(Number(e.target.value))}
					>
						{[100, 150, 200].map((v) => (
							<option key={v} value={v}>
								{v}%
							</option>
						))}
					</select>
				</label>
			</div>
			<p className="px-4 py-2 text-xs text-muted-foreground">
				{complete
					? "Reviewed list held for this screenshot. Inventory has not changed."
					: "Click a box to identify or correct it. Hide successes to focus on yellow issues; fill boxes to spot gaps."}
			</p>
			<div className="grid items-start lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
				<div className="max-h-[78vh] overflow-auto p-3">
					<div
						role="group"
						aria-label="Screenshot review canvas"
						className="relative isolate select-none"
						style={{ width: `${zoom}%` }}
					>
						<img
							src={image.url}
							alt="Uploaded stash screenshot"
							draggable={false}
							className="block h-auto w-full rounded"
						/>
						{boxes.map((box, index) => {
							const item = box.itemId ? byId.get(box.itemId) : null;
							if (item && !showSuccesses) return null;
							return (
								<button
									key={box.id}
									type="button"
									disabled={complete}
									aria-label={`Box ${index + 1}: ${item?.name ?? "Unknown item"}`}
									aria-pressed={box.id === selected}
									title={box.text ? `Read: ${box.text}` : "Manually selected box"}
									onClick={() => select(box.id)}
									className={cn(
										"absolute cursor-pointer border-2 text-left focus:outline-none focus:ring-2 focus:ring-brand",
										item ? "border-brand/70 hover:bg-brand/15" : "border-warning/80 hover:bg-warning/15",
										filled && (item ? "bg-brand/35" : "bg-warning/35"),
										selected === box.id && "z-10 ring-2 ring-foreground",
									)}
									style={position(box.bounds)}
								>
									<span className="absolute left-0 top-0 max-w-full truncate bg-card/90 px-1 text-[10px] leading-tight text-foreground">
										{index + 1}
										{!item ? " ?" : ""}
										{box.confirmed ? " ✓" : ""}
									</span>
								</button>
							);
						})}
					</div>
				</div>
				<aside className="min-w-0 border-t border-border-color p-4 lg:border-l lg:border-t-0">
					<h2 className="font-semibold text-foreground">
						{complete ? "Reviewed list" : active ? `Edit box ${boxes.indexOf(active) + 1}` : "Review items"}
					</h2>
					<p className="mt-1 text-xs text-muted-foreground" aria-live="polite">
						{new Set(summary.totals.map((total) => total.item.id)).size} item types · {boxes.length} boxes ·{" "}
						{summary.unresolved} unassigned
					</p>
					{!complete && active && (
						<div className="mt-4 space-y-3">
							<div
								className="relative mx-auto overflow-hidden rounded border border-border-color"
								style={{
									width: Math.min(
										180,
										(180 * active.bounds.width * image.width) / (active.bounds.height * image.height),
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
							<p className="text-sm text-foreground">
								{active.itemId ? byId.get(active.itemId)?.name : "Unknown item"}
								{active.text && <span className="block text-xs text-muted-foreground">Read: {active.text}</span>}
							</p>
							<QuickAddSearch
								mode={mode}
								query={query}
								onQueryChange={setQuery}
								onPick={assign}
								inputRef={searchInput}
							/>
							{suggestions.length > 0 && (
								<div className="max-h-48 space-y-1 overflow-y-auto" aria-label="Suggested items">
									<p className="text-xs text-muted-foreground">{query ? "Close label matches" : "Suggested items"}</p>
									{suggestions.map((item) => (
										<button
											key={item.id}
											className="flex w-full items-center gap-2 rounded border border-border-color p-2 text-left text-xs text-foreground hover:bg-surface-raised"
											onClick={() => assign(item)}
										>
											<img src={itemImageUrl(item)} alt="" className="h-8 w-8 object-contain" />
											{item.name}
										</button>
									))}
								</div>
							)}
							<label className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
								Found in raid
								<select
									aria-label="Found in raid status"
									className={control}
									value={active.foundInRaid}
									onChange={(event) =>
										patch(active.id, { foundInRaid: event.target.value as FoundInRaidStatus, firConfirmed: true })
									}
								>
									<option value="unknown">Unknown</option>
									<option value="yes">Found in raid</option>
									<option value="no">Not found in raid</option>
								</select>
							</label>
							<p className="text-xs text-muted-foreground">
								{active.firConfirmed
									? "FIR status set by you."
									: active.foundInRaid === "yes"
										? "FIR badge detected. You can correct this."
										: "FIR badge not confirmed. This does not mean the item is non-FIR."}
							</p>
							<label className="flex items-center justify-between text-sm text-muted-foreground">
								Quantity{" "}
								<input
									key={`${active.id}:${active.quantity}`}
									aria-label="Box quantity"
									type="number"
									min={1}
									max={999999}
									defaultValue={active.quantity}
									className={cn(control, "w-24")}
									onBlur={(e) => {
										const value = Number(e.target.value);
										if (Number.isSafeInteger(value) && value > 0 && value <= 999999)
											patch(active.id, { quantity: value });
										else e.target.value = String(active.quantity);
									}}
								/>
							</label>
							<div className="flex flex-wrap gap-2">
								<button
									className={control}
									onClick={() => {
										change(boxes.filter((box) => box.id !== active.id));
										setSelected(null);
									}}
								>
									Remove box
								</button>
							</div>
						</div>
					)}
					{!complete && !active && (
						<p className="mt-4 text-sm text-muted-foreground">
							Select a box. Assign or remove unknowns before finishing. Quantities start at one per box.
						</p>
					)}
					{!complete && (
						<button
							className={cn(control, "mt-5 w-full border-brand bg-brand text-inverse")}
							disabled={!boxes.length || !!summary.unresolved}
							onClick={() => {
								setReviewedList(finishReview(boxes, items));
								setSelected(null);
							}}
						>
							Finish review
						</button>
					)}
					{complete && (
						<p className="mt-3 text-sm text-muted-foreground">
							Ready for the next step. This list stays on this page until you change the screenshot or leave.
						</p>
					)}
					<div className="mt-5 max-h-[45vh] space-y-1 overflow-y-auto">
						{complete
							? heldTotals.map(({ item, itemId, quantity, foundInRaid }) => (
									<div
										key={`${itemId}:${foundInRaid}`}
										className="flex items-center gap-2 border-b border-border-color py-2 text-sm text-foreground"
									>
										{item && <img src={itemImageUrl(item)} alt="" className="h-8 w-8 object-contain" />}
										<span className="flex-1">
											{item?.name ?? `Missing catalog item: ${itemId}`}
											<span className="block text-xs text-muted-foreground">{foundInRaidLabel(foundInRaid)}</span>
										</span>
										<span>×{quantity}</span>
									</div>
								))
							: boxes.map((box, index) =>
									!showSuccesses && box.itemId && byId.has(box.itemId) ? null : (
										<button
											key={box.id}
											className={cn(
												"flex w-full gap-2 rounded px-2 py-1 text-left text-xs hover:bg-surface-raised",
												box.itemId ? "text-muted-foreground" : "text-warning",
												selected === box.id && "bg-brand/10",
											)}
											onClick={() => select(box.id)}
										>
											<span>{index + 1}.</span>
											<span className="flex-1">
												{box.itemId ? byId.get(box.itemId)?.name : "Unknown item"}
												<span className="block text-subtle-foreground">{foundInRaidLabel(box.foundInRaid)}</span>
											</span>
											<span>×{box.quantity}</span>
										</button>
									),
								)}
					</div>
				</aside>
			</div>
		</section>
	);
}
