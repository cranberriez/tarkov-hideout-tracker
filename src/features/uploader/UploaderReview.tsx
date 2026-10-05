"use client";

/* eslint-disable @next/next/no-img-element -- Local screenshot crops and catalog previews. */
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { ImagePlus, Undo2 } from "lucide-react";
import type { ItemSummary } from "@/types/items";
import { itemImageUrl } from "@/lib/utils/item-images";
import { cn } from "@/lib/utils";
import { UploaderDecisionView } from "./UploaderDecisionView";
import { useUploaderSummary } from "./useUploaderSummary";
import { useUploaderDecisions, type DecisionFilter } from "./useUploaderDecisions";
import { DecisionMarker, decisionAppearance } from "./DecisionMarker";
import type { SentCounts } from "./inventory-model";
import { KeyHint, UploaderSidebarHeader, UploaderStepNav, sectionLabel } from "./UploaderSidebarHeader";
import type { Screenshot } from "./image-recognition";
import { suggestLabelCandidates } from "./label-suggestions";
import { buildLabelIndex, type ItemDetection } from "./recognition-model";
import { seedReviewBoxes, suggestReviewGrid, summarizeReview, type ReviewBox, type ReviewEntry } from "./review-model";
import { nextUnknownId, selectReviewBoxes, selectionSuggestions, supportsQuantity } from "./selection-model";
import { UploaderCompletion, type AddedItem } from "./UploaderCompletion";
import styles from "./UploaderReview.module.css";

const control =
	"flex items-center justify-between gap-2 rounded-sm border border-highlight/10 bg-shadow/20 px-3 py-2.5 text-sm text-foreground transition-colors hover:border-brand/50 hover:bg-brand/15 disabled:opacity-40";
/** Dark wash over boxes that are done or out of focus, so bright areas stand out. */
const dimmed = "bg-shadow/75";
const FILTERS: DecisionFilter[] = ["ALL", "KEEP", "SELL", "HOLD"];

export function UploaderReview({
	image,
	detections,
	items,
	onNewScan,
	dirtyRef,
	bottomBar,
}: {
	image: Screenshot;
	detections: ItemDetection[];
	items: ItemSummary[];
	/** Opens the image picker for a replacement scan. */
	onNewScan: () => void;
	/** Lets the page confirm before a paste or drop discards review progress. */
	dirtyRef: RefObject<boolean>;
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
	const search = useRef<HTMLInputElement>(null);
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
	const [highlight, setHighlight] = useState({ key: "", index: 0 });
	const [keepReviewing, setKeepReviewing] = useState(false);
	const [ignoreUnknowns, setIgnoreUnknowns] = useState(false);
	const [summaryOpen, setSummaryOpen] = useState(false);
	// FIR mode returns to the step that opened it.
	const [firMode, setFirMode] = useState<"review" | "summary" | null>(null);
	const [added, setAdded] = useState<AddedItem[]>([]);
	const serial = useRef(0);
	const [summaryEntries, setSummaryEntries] = useState<ReviewEntry[]>([]);
	// Sends are tracked per scan so repeats add only the difference and kept copies stay kept.
	const [sent, setSent] = useState<SentCounts>({});
	const decisionEntries = summaryOpen ? summaryEntries : boxes;
	const summaryData = useUploaderSummary(decisionEntries, items, sent);
	const decisions = useUploaderDecisions(summaryData, decisionEntries);
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
	const highlightKey = `${query}|${selected.join(",")}`;
	const highlighted = highlight.key === highlightKey ? Math.min(highlight.index, suggestions.length - 1) : 0;
	const unknowns = boxes.filter((box) => !box.itemId || !byId.has(box.itemId));
	const classified = boxes.length > 0 && unknowns.length === 0;
	// The missing-items step only while neither sorting nor setting FIR.
	const completing = (classified || ignoreUnknowns) && !keepReviewing && !summaryOpen && !firMode;
	const classifying = !completing && !summaryOpen && !firMode;
	const included = ignoreUnknowns ? boxes.filter((box) => box.itemId && byId.has(box.itemId)) : boxes;
	const nextEntries = [...included, ...added];
	const nextSummary = summarizeReview(nextEntries, items);
	const firUnknown = boxes.filter((box) => box.itemId && byId.has(box.itemId) && box.foundInRaid === "unknown").length;
	const dirty = history.length > 1 || added.length > 0 || Object.keys(sent).length > 0;
	const [confirmingNewScan, setConfirmingNewScan] = useState(false);
	useEffect(() => {
		dirtyRef.current = dirty;
	}, [dirty, dirtyRef]);
	useEffect(
		() => () => {
			dirtyRef.current = false;
		},
		[dirtyRef],
	);
	const firCounts = { yes: 0, no: 0 };
	for (const box of boxes) if (box.itemId && box.foundInRaid !== "unknown") firCounts[box.foundInRaid]++;

	// The search box takes focus with each new selection so typing starts immediately.
	useEffect(() => {
		if (classifying && selected.length) search.current?.focus({ preventScroll: true });
	}, [classifying, selected]);

	const commit = (update: (box: ReviewBox) => ReviewBox) =>
		setHistory((previous) => [...previous.slice(-29), previous[previous.length - 1].map(update)]);
	const focusBox = (id: string) => {
		setSelected([id]);
		anchor.current = id;
		canvas.current
			?.querySelector<HTMLButtonElement>(`[data-box-index="${boxes.findIndex((box) => box.id === id)}"]`)
			?.scrollIntoView({ block: "nearest", inline: "nearest" });
	};
	const clearSelection = () => {
		setSelected([]);
		anchor.current = null;
		setQuery("");
	};
	const patch = (update: Partial<ReviewBox>) =>
		commit((box) => (selected.includes(box.id) ? { ...box, ...update } : box));
	const assign = (item: ItemSummary, advance = false) => {
		if (!chosen.length) return;
		commit((box) =>
			selected.includes(box.id)
				? { ...box, itemId: item.id, confirmed: true, quantity: supportsQuantity(item) ? box.quantity : 1 }
				: box,
		);
		setQuery("");
		setKeepReviewing(false);
		const remaining = unknowns.filter((box) => !selected.includes(box.id)).map((box) => box.id);
		if (!remaining.length) return clearSelection();
		if (advance) {
			const next = nextUnknownId(
				boxes.map((box) => box.id),
				remaining,
				anchor.current,
			);
			if (next) focusBox(next);
			else clearSelection();
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
	const moveHighlight = (step: 1 | -1) => {
		if (!suggestions.length) return;
		setHighlight({ key: highlightKey, index: (highlighted + step + suggestions.length) % suggestions.length });
	};
	const allFir = chosen.length > 0 && chosen.every((box) => box.foundInRaid === "yes");
	const firStatus = chosen.every((box) => box.foundInRaid === active?.foundInRaid) ? active?.foundInRaid : "mixed";
	const toggleFir = () => {
		if (chosen.length) patch({ foundInRaid: allFir ? "no" : "yes", firConfirmed: true });
	};
	const flipFir = (id: string) =>
		commit((box) =>
			box.id === id ? { ...box, foundInRaid: box.foundInRaid === "yes" ? "no" : "yes", firConfirmed: true } : box,
		);
	const setRemainingFir = (foundInRaid: "yes" | "no") =>
		commit((box) =>
			box.itemId && byId.has(box.itemId) && box.foundInRaid === "unknown"
				? { ...box, foundInRaid, firConfirmed: true }
				: box,
		);
	const continueFromClassify = () => {
		setIgnoreUnknowns(unknowns.length > 0);
		setKeepReviewing(false);
		clearSelection();
	};
	const backToClassify = () => {
		setKeepReviewing(true);
		setIgnoreUnknowns(false);
	};
	const openSummary = () => {
		setSummaryEntries(nextEntries);
		setSummaryOpen(true);
	};
	const openFirMode = () => {
		clearSelection();
		setFirMode(summaryOpen ? "summary" : "review");
		setSummaryOpen(false);
	};
	const closeFirMode = () => {
		if (firMode === "summary") openSummary();
		setFirMode(null);
	};

	const sortKeydown = (event: KeyboardEvent) => {
		const filter = FILTERS[Number(event.key) - 1];
		if (filter) {
			event.preventDefault();
			decisions.setFilter(filter);
		} else if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
			const keys = [
				...new Set(
					boxes.flatMap((box) => {
						const decision = decisions.decisionFor(box);
						return decision && (decisions.filter === "ALL" || decision.action === decisions.filter)
							? [decision.key]
							: [];
					}),
				),
			];
			if (!keys.length) return;
			event.preventDefault();
			const current = decisions.activeKey ? keys.indexOf(decisions.activeKey) : -1;
			const next = event.key === "ArrowRight" ? current + 1 : current <= 0 ? keys.length - 1 : current - 1;
			decisions.select(keys[next % keys.length]);
		}
	};
	useEffect(() => {
		const keydown = (event: KeyboardEvent) => {
			if (event.defaultPrevented || event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey)
				return;
			const target = event.target instanceof Element ? event.target : null;
			if (target?.closest("input, textarea, select, [contenteditable=true], [role=dialog]")) return;
			if (firMode) {
				if (event.key === "Escape") closeFirMode();
				return;
			}
			if (summaryOpen) return sortKeydown(event);
			if (completing || event.shiftKey) return;
			if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
				event.preventDefault();
				navigateUnknown(event.key === "ArrowRight" ? 1 : -1);
			} else if (event.key.toLowerCase() === "f") {
				event.preventDefault();
				toggleFir();
			} else if (event.key === "Enter" && !target?.closest("button, a") && suggestions[highlighted]) {
				event.preventDefault();
				assign(suggestions[highlighted], true);
			}
		};
		window.addEventListener("keydown", keydown);
		return () => window.removeEventListener("keydown", keydown);
	});

	const boxAppearance = (box: ReviewBox, known: boolean) => {
		if (firMode)
			return known ? (box.foundInRaid === "unknown" ? "border-2 border-fir bg-transparent" : dimmed) : dimmed;
		if (completing) return dimmed;
		if (summaryOpen) {
			const decision = decisions.decisionFor(box);
			if (!decision) return "bg-shadow/65";
			const shown = decisions.filter === "ALL" || decisions.filter === decision.action;
			return shown ? decisionAppearance[decision.action].overlay : dimmed;
		}
		return known
			? "border border-transparent bg-shadow/65 hover:bg-shadow/40"
			: "border border-warning/80 bg-warning/20 hover:bg-warning/30";
	};
	const nav = summaryOpen
		? { back: { label: "Back to review", onClick: () => setSummaryOpen(false) } }
		: firMode
			? {
					forward: {
						label: firMode === "summary" ? "Done · back to sorting" : "Done",
						onClick: closeFirMode,
					},
				}
			: completing
				? {
						back: { label: "Review", onClick: backToClassify },
						forward: {
							label: "Sort loot",
							onClick: openSummary,
							disabled: nextSummary.unresolved > 0 || nextSummary.totals.length === 0,
						},
					}
				: {
						forward: {
							label: classified ? "Continue" : "Skip unknowns and continue",
							onClick: continueFromClassify,
							disabled: !boxes.length,
						},
						note:
							unknowns.length > 0 &&
							`${unknowns.length} unknown ${unknowns.length === 1 ? "item stays" : "items stay"} out of the summary. You can come back to them.`,
					};

	return (
		<section
			className="relative grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] grid-cols-[minmax(0,1fr)_20rem] overflow-hidden max-sm:grid-cols-[minmax(0,1fr)_15rem]"
			aria-label="Review scanned items"
		>
			<div ref={canvas} tabIndex={-1} className="min-h-0 overflow-auto bg-shadow/30 p-3 outline-none">
				<div
					role="group"
					aria-label="Screenshot review canvas"
					className="relative isolate mx-auto select-none"
					style={{ width: (fitWidth * zoom) / 100 }}
				>
					<img src={image.url} alt="Uploaded stash screenshot" draggable={false} className="block h-auto w-full" />
					{boxes.map((box, number) => {
						const item = box.itemId ? byId.get(box.itemId) : undefined;
						const decision = summaryOpen ? decisions.decisionFor(box) : undefined;
						const shown = !!decision && (decisions.filter === "ALL" || decisions.filter === decision.action);
						const picked = summaryOpen
							? !!decision && decisions.activeKey === decision.key
							: classifying && selected.includes(box.id);
						const inert = completing || (!!firMode && !item);
						const status = summaryOpen
							? ` · ${decision ? (decision.pending ? "Loading decision" : decisionAppearance[decision.action].label) : item && decisions.loading ? "Loading decision" : "Excluded"}`
							: firMode && item
								? ` · ${box.foundInRaid === "yes" ? "Found in raid" : box.foundInRaid === "no" ? "Not found in raid" : "FIR unknown"}`
								: "";
						return (
							<button
								key={box.id}
								type="button"
								data-box-index={number}
								disabled={inert}
								aria-label={`Box ${number + 1}: ${item?.name ?? "Unknown item"}${status}`}
								aria-pressed={firMode && item ? box.foundInRaid === "yes" : picked}
								onClick={(event) => {
									if (summaryOpen) {
										if (decision) decisions.select(decision.key);
										return;
									}
									if (firMode) {
										if (item) flipFir(box.id);
										return;
									}
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
								}}
								className={cn(
									"absolute text-left transition-colors duration-200 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-foreground",
									inert ? "cursor-default" : "cursor-pointer",
									boxAppearance(box, !!item),
									picked && (summaryOpen ? "z-10 ring-2 ring-foreground" : "z-10 bg-brand/25 ring-2 ring-foreground"),
								)}
								style={{
									left: `${box.bounds.left * 100}%`,
									top: `${box.bounds.top * 100}%`,
									width: `${box.bounds.width * 100}%`,
									height: `${box.bounds.height * 100}%`,
								}}
							>
								<span
									hidden={!classifying}
									aria-hidden="true"
									className={cn(
										"pointer-events-none absolute inset-0",
										styles.reveal,
										item ? "bg-success/80" : "bg-warning/80",
									)}
									style={{ animationDelay: `${number * Math.min(65, 1800 / Math.max(1, boxes.length))}ms` }}
								/>
								{summaryOpen
									? (decision ? shown : !!item && decisions.loading) && (
											<span className="absolute left-0.5 top-0.5">
												<DecisionMarker action={decision?.action} pending={!decision || decision.pending} />
											</span>
										)
									: firMode
										? item && (
												<span
													className={cn(
														"absolute left-0.5 top-0.5 rounded-sm px-1 text-[10px] font-bold leading-tight",
														box.foundInRaid === "yes"
															? "bg-fir/90 text-inverse"
															: box.foundInRaid === "no"
																? "bg-card/90 text-muted-foreground"
																: "bg-card/90 text-fir",
													)}
												>
													{box.foundInRaid === "yes" ? "FIR" : box.foundInRaid === "no" ? "Not FIR" : "FIR?"}
												</span>
											)
										: classifying && (
												<span className="absolute left-0 top-0 bg-card/90 px-1 text-[10px] leading-tight text-foreground">
													{number + 1}
													{!item ? " ?" : box.confirmed ? " ✓" : ""}
												</span>
											)}
							</button>
						);
					})}
				</div>
			</div>
			<aside className="col-start-2 row-start-1 row-span-2 flex min-h-0 flex-col overflow-hidden border-l border-border-color bg-card p-4">
				<div className="-mx-4 -mt-4 min-h-0 flex-1 overflow-y-auto px-4 pt-4">
					{summaryOpen ? (
						<UploaderDecisionView
							data={summaryData}
							decisions={decisions}
							extras={added}
							sent={sent}
							onSent={(deltas) =>
								setSent((previous) => {
									const next = { ...previous };
									for (const delta of deltas) {
										const current = next[delta.itemId] ?? { have: 0, haveFir: 0 };
										next[delta.itemId] = { have: current.have + delta.have, haveFir: current.haveFir + delta.haveFir };
									}
									return next;
								})
							}
							onSetFir={openFirMode}
						/>
					) : firMode ? (
						<div className="space-y-4">
							<UploaderSidebarHeader
								step={1}
								title="Set found in raid"
								detail={firUnknown ? `${firUnknown} still need a choice` : "Every item has a FIR status"}
							/>
							<p className="text-xs text-muted-foreground">
								Items that still need a choice stay bright. Click any item to switch it between found in raid and not
								found in raid.
							</p>
							<div className="grid grid-cols-3 gap-2 text-center">
								{[
									["FIR", firCounts.yes, "text-fir"],
									["Not FIR", firCounts.no, "text-muted-foreground"],
									["Unknown", firUnknown, firUnknown ? "text-warning" : "text-muted-foreground"],
								].map(([label, count, ink]) => (
									<div key={label} className="rounded bg-shadow/30 p-2">
										<p className={cn("text-[10px] font-bold uppercase tracking-wide", ink)}>{label}</p>
										<p className="font-mono text-sm font-semibold tabular-nums text-foreground">{count}</p>
									</div>
								))}
							</div>
							{firUnknown > 0 && (
								<section className="space-y-2">
									<h2 className={sectionLabel}>Set the remaining {firUnknown}</h2>
									<div className="grid grid-cols-2 gap-2">
										<button className={control} onClick={() => setRemainingFir("yes")}>
											All FIR
										</button>
										<button className={control} onClick={() => setRemainingFir("no")}>
											All not FIR
										</button>
									</div>
								</section>
							)}
							<UndoButton
								disabled={history.length < 2}
								onUndo={() => setHistory((previous) => previous.slice(0, -1))}
							/>
						</div>
					) : (
						<>
							<UploaderSidebarHeader
								step={1}
								title={completing ? "Add anything missed" : "Classify items"}
								detail={
									completing
										? `${included.length} found${added.length ? ` · ${added.length} added` : ""}`
										: unknowns.length
											? `${unknowns.length} of ${boxes.length} still unknown`
											: boxes.length
												? `All ${boxes.length} items classified`
												: "No items detected — try another image"
								}
							/>
							{completing ? (
								<UploaderCompletion
									boxes={included}
									items={items}
									added={added}
									onAdd={(item) =>
										setAdded((previous) => [
											...previous,
											{ id: ++serial.current, itemId: item.id, quantity: 1, foundInRaid: "no" },
										])
									}
									onPatch={(id, update) =>
										setAdded((previous) =>
											previous.map((entry) =>
												entry.id === id ? { ...entry, ...update, itemId: entry.itemId } : entry,
											),
										)
									}
									onRemove={(id) => setAdded((previous) => previous.filter((entry) => entry.id !== id))}
									firUnknown={firUnknown}
									onSetFir={openFirMode}
								/>
							) : (
								<>
									<div className="grid gap-2 border-b border-border-color py-4">
										<button className={control} disabled={!unknowns.length} onClick={() => navigateUnknown(1)}>
											Next unknown <KeyHint>→</KeyHint>
										</button>
										<button
											className={control}
											disabled={!active || !suggestions.length}
											onClick={() => suggestions[highlighted] && assign(suggestions[highlighted], true)}
										>
											Use highlighted match <KeyHint>Enter</KeyHint>
										</button>
										<button className={control} disabled={!firUnknown} onClick={openFirMode}>
											Set found in raid
											<span className="text-xs tabular-nums text-fir">{firUnknown || ""}</span>
										</button>
										<UndoButton
											disabled={history.length < 2}
											onUndo={() => setHistory((previous) => previous.slice(0, -1))}
										/>
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
														{chosen.length > 1
															? `${chosen.length} items selected`
															: `Item ${boxes.indexOf(active) + 1}`}
													</p>
													<p className="mt-1 text-sm text-foreground">
														{chosen.length > 1
															? "Assign one type to all selected"
															: (activeItem?.name ?? "Unknown item")}
													</p>
												</div>
											</div>
											<button
												onClick={toggleFir}
												aria-pressed={allFir}
												aria-keyshortcuts="f"
												className={cn(
													"flex w-full items-center justify-between rounded-sm border border-border-color px-3 py-3 text-sm font-semibold",
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
													ref={search}
													id="review-search"
													type="search"
													placeholder="Type to search items…"
													value={query}
													autoComplete="off"
													aria-controls="review-matches"
													aria-activedescendant={
														suggestions[highlighted] ? `review-match-${suggestions[highlighted].id}` : undefined
													}
													onChange={(event) => setQuery(event.target.value)}
													onKeyDown={(event) => {
														if (event.nativeEvent.isComposing) return;
														if (event.key === "ArrowDown" || event.key === "ArrowUp") {
															event.preventDefault();
															moveHighlight(event.key === "ArrowDown" ? 1 : -1);
														} else if (event.key === "Enter" && suggestions[highlighted]) {
															event.preventDefault();
															assign(suggestions[highlighted], true);
														} else if ((event.key === "ArrowRight" || event.key === "ArrowLeft") && !query) {
															event.preventDefault();
															navigateUnknown(event.key === "ArrowRight" ? 1 : -1);
														} else if (event.key === "Escape" && !query) {
															event.preventDefault();
															canvas.current?.focus({ preventScroll: true });
														}
													}}
													className="w-full rounded-sm bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-brand"
												/>
											</div>
											<div
												id="review-matches"
												role="listbox"
												aria-label="Suggested items"
												className="border-t border-border-color pt-4"
											>
												<p className={cn(sectionLabel, "mb-1")}>{query ? "Search matches" : "Best matches"}</p>
												{suggestions.map((item, rank) => (
													<button
														key={item.id}
														id={`review-match-${item.id}`}
														role="option"
														aria-selected={rank === highlighted}
														onClick={() => {
															assign(item);
															search.current?.focus({ preventScroll: true });
														}}
														onMouseEnter={() => setHighlight({ key: highlightKey, index: rank })}
														className={cn(
															"mb-1 flex w-full items-center gap-2 rounded-sm border px-2 py-2 text-left text-sm text-foreground",
															rank === highlighted
																? "border-brand/60 bg-brand/10"
																: "border-border-color hover:bg-surface-raised",
														)}
													>
														<img src={itemImageUrl(item)} alt="" className="h-8 w-8 object-contain" />
														<span className="flex-1">{item.name}</span>
														{rank === highlighted && <KeyHint>↵</KeyHint>}
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
															if (Number.isSafeInteger(quantity) && quantity > 0 && quantity <= 999999)
																patch({ quantity });
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
								</>
							)}
						</>
					)}
				</div>
				<UploaderStepNav {...nav} backRef={summaryBack} />
				<div className="-mx-4 -mb-4 flex shrink-0 items-center justify-between gap-2 border-t border-border-color bg-surface-raised/40 px-3 py-2 text-xs text-muted-foreground">
					{confirmingNewScan ? (
						<span className="flex items-center gap-2">
							<span className="text-warning">Discard this review?</span>
							<button
								onClick={() => {
									setConfirmingNewScan(false);
									onNewScan();
								}}
								className="font-semibold text-warning underline"
							>
								New scan
							</button>
							<button onClick={() => setConfirmingNewScan(false)} className="hover:text-foreground">
								Cancel
							</button>
						</span>
					) : (
						<button
							onClick={() => (dirty ? setConfirmingNewScan(true) : onNewScan())}
							className="flex items-center gap-1.5 hover:text-foreground"
						>
							<ImagePlus size={13} aria-hidden="true" />
							New scan
						</button>
					)}
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
			</aside>
			{classifying ? (
				bottomBar
			) : (
				<div className="col-start-1 row-start-2 min-w-0 border-t border-border-color bg-surface-raised/40 px-3 py-2 text-[11px] text-muted-foreground">
					{summaryOpen ? (
						<>
							Click an item for details · <KeyHint>1</KeyHint>–<KeyHint>4</KeyHint> Filter · <KeyHint>←</KeyHint>{" "}
							<KeyHint>→</KeyHint> Previous / next item
						</>
					) : firMode ? (
						<>
							Click an item to switch FIR · <KeyHint>Esc</KeyHint> Done
						</>
					) : (
						"Bright areas on the screenshot weren't detected. Add them in the sidebar."
					)}
				</div>
			)}
		</section>
	);
}

function UndoButton({ disabled, onUndo }: { disabled: boolean; onUndo: () => void }) {
	return (
		<button
			disabled={disabled}
			onClick={onUndo}
			className="flex items-center justify-center gap-2 rounded-sm px-3 py-1.5 text-xs text-muted-foreground hover:bg-surface-raised hover:text-foreground disabled:opacity-40"
		>
			<Undo2 size={13} aria-hidden="true" />
			Undo last change
		</button>
	);
}
