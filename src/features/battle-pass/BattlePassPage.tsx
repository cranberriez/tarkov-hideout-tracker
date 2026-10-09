"use client";

/* eslint-disable @next/next/no-img-element -- Source CDN artwork, no image proxy required. */
import { useMemo, useState, type CSSProperties, type ReactNode, type SyntheticEvent } from "react";
import { Check, FileText, Flag, LockKeyhole, Map as MapIcon, Layers, ChevronDown, Ban, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import locations from "@/lib/data/season-1-document-locations.json";
import {
	coverCosts,
	documents,
	normalizeCount,
	pages,
	planGoals,
	tiles,
	toggleId,
	totalCost,
	unlockedPages,
	type Costs,
	type Tile,
} from "./battle-pass-model";
import { useBattlePass } from "./useBattlePass";
import styles from "./battle-pass.module.css";

const mapNames: Record<string, string[]> = locations.mapsByDocumentKey;
const mapOrder = [
	"Factory",
	"Customs",
	"Ground Zero",
	"Interchange",
	"Streets of Tarkov",
	"Reserve",
	"Lighthouse",
	"Shoreline",
	"Woods",
	"The Lab",
	"The Labyrinth",
	"Icebreaker",
];

function Artwork({ src, className = "" }: { src: string; className?: string }) {
	const [failed, setFailed] = useState(false);
	return failed ? (
		<FileText aria-label="Image unavailable" className={cn("text-subtle-foreground", className)} />
	) : (
		<img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className={cn("object-contain", className)} />
	);
}

function DocumentChip({
	doc,
	amount,
	end = false,
}: {
	doc: { name: string; img?: string };
	amount?: number;
	end?: boolean;
}) {
	const [placement, setPlacement] = useState({ end, width: 280 });
	const placeLabel = (event: SyntheticEvent<HTMLElement>) => {
		const box = event.currentTarget.getBoundingClientRect();
		const left = box.left - 16;
		const right = window.innerWidth - box.right - 16;
		const alignEnd = right < 280 && left > right;
		setPlacement({ end: alignEnd, width: Math.min(280, Math.max(80, alignEnd ? left : right)) });
	};
	return (
		<span
			tabIndex={0}
			onMouseEnter={placeLabel}
			onFocus={placeLabel}
			style={{ "--label-width": `${placement.width}px` } as CSSProperties}
			aria-label={`${doc.name}${amount !== undefined ? `: ${amount}` : ""}`}
			className={cn(styles.chip, placement.end && styles.end, amount === undefined && styles.documentOnly)}
		>
			<span className={styles.chipInner}>
				<span className="flex shrink-0 items-center gap-0.5">
					{doc.img ? <Artwork src={doc.img} className="h-9 w-8" /> : <FileText className="h-8 w-8 text-special" />}
					{amount !== undefined && <span className="text-xs font-semibold tabular-nums">{amount}</span>}
				</span>
				<span className={cn(styles.label, styles.documentLabel)}>{doc.name}</span>
			</span>
		</span>
	);
}

function ActionChip({
	active,
	label,
	accessibleLabel,
	icon,
	onClick,
	tone,
}: {
	active: boolean;
	label: string;
	accessibleLabel: string;
	icon: ReactNode;
	onClick: () => void;
	tone: "goal" | "done" | "avoid";
}) {
	return (
		<button
			type="button"
			aria-label={accessibleLabel}
			aria-pressed={active}
			onClick={onClick}
			className={cn(
				styles.chip,
				styles.action,
				styles.end,
				tone === "avoid"
					? "text-danger"
					: active
						? tone === "goal"
							? "text-brand"
							: "text-success"
						: "text-muted-foreground",
			)}
		>
			<span className={styles.chipInner}>
				<span className="flex w-6 shrink-0 justify-center">{icon}</span>
				<span className={styles.label}>{label}</span>
			</span>
		</button>
	);
}

function CostList({ costs }: { costs: Costs }) {
	const shown = documents.filter((doc) => (costs[doc.key] ?? 0) > 0);
	return (
		<div className="flex min-h-10 flex-wrap gap-1">
			{shown.map((doc, i) => (
				<DocumentChip key={doc.key} doc={doc} amount={costs[doc.key]} end={i >= Math.ceil(shown.length / 2)} />
			))}
			{shown.length === 0 && (
				<span className="flex items-center gap-1 text-xs text-success">
					<Check size={15} />
					Complete
				</span>
			)}
		</div>
	);
}

function RewardCard({
	tile,
	pageNumber,
	done,
	goal,
	filler,
	costs,
	toggleGoal,
	toggleDone,
}: {
	tile: Tile;
	pageNumber: number;
	done: boolean;
	goal: boolean;
	filler: boolean;
	costs: Costs;
	toggleGoal: () => void;
	toggleDone: () => void;
}) {
	const label = `Page ${pageNumber}, ${tile.displayName}`;
	const name = tile.displayName + (tile.rewards[0].type === "tarcoin" ? ` ×${tile.rewards[0].value}` : "");
	return (
		<article className={cn(styles.card, "min-w-0 rounded-lg bg-card", done && "bg-success/5")}>
			<div className="relative">
				<div className="relative flex h-[188px] items-center justify-center overflow-hidden rounded-t-lg bg-surface-raised/30 sm:h-[220px]">
					<Artwork
						src={tile.bigImg || tile.img}
						className={cn(styles.image, "h-full w-full p-5", done && "opacity-50")}
					/>
				</div>
				{filler && !done && !goal && (
					<span className="absolute left-2 top-2 rounded bg-info-surface px-2 py-1 text-[10px] font-medium text-info">
						Suggested
					</span>
				)}
				<div className="absolute right-2 top-2 flex gap-1">
					<ActionChip
						active={goal}
						tone="goal"
						label={goal ? "Remove goal" : "Set goal"}
						accessibleLabel={`${goal ? "Remove goal" : "Set goal"}: ${label}`}
						onClick={toggleGoal}
						icon={<Flag size={17} fill={goal ? "currentColor" : "none"} />}
					/>
					<ActionChip
						active={done}
						tone="done"
						label={done ? "Mark incomplete" : "Complete"}
						accessibleLabel={`${done ? "Mark incomplete" : "Mark completed"}: ${label}`}
						onClick={toggleDone}
						icon={<Check size={19} strokeWidth={done ? 3 : 1.8} />}
					/>
				</div>
			</div>
			<div className="space-y-2 px-3 pb-2.5 pt-2">
				<div className="flex items-center justify-between gap-2">
					<h3 title={name} className="min-w-0 truncate text-sm font-medium">
						{name}
					</h3>
					<span title="Total documents" className="shrink-0 text-[11px] tabular-nums text-subtle-foreground">
						{totalCost(costs)}
					</span>
				</div>
				<CostList costs={costs} />
			</div>
			{tile.rewards.length > 1 && (
				<details className="group relative px-3 pb-2 text-xs text-muted-foreground">
					<summary className="w-fit cursor-pointer list-none">+{tile.rewards.length - 1} bundled offers</summary>
					<ul className="absolute inset-x-0 top-full z-30 space-y-2 rounded bg-surface-raised p-3 shadow-xl">
						{tile.rewards.map((reward, i) => (
							<li key={reward.bsgId ?? i}>{reward.name}</li>
						))}
					</ul>
				</details>
			)}
		</article>
	);
}

function MapGrid() {
	return (
		<div className="overflow-x-auto rounded-lg bg-card p-3 sm:p-4">
			<table className="mx-auto w-full min-w-[630px] max-w-5xl table-fixed border-separate border-spacing-1 text-xs">
				<caption className="sr-only">
					Possible document spawns per map: seven per relevant type, five on Factory
				</caption>
				<thead>
					<tr>
						<th scope="col" className="w-36 text-left font-normal text-subtle-foreground">
							Spawns / type
						</th>
						{documents.map((doc, i) => (
							<th scope="col" key={doc.key} className="h-14 pb-1 font-normal">
								<DocumentChip doc={doc} end={i > 3} />
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{mapOrder.map((map) => (
						<tr key={map} className="group">
							<th
								scope="row"
								className="whitespace-nowrap py-1.5 pr-3 text-left font-medium text-muted-foreground group-hover:text-foreground"
							>
								{map}
							</th>
							{documents.map((doc) => {
								const relevant = mapNames[doc.key]?.includes(map);
								const count =
									map === "Factory" ? locations.spawnsPerRelevantType.factory : locations.spawnsPerRelevantType.default;
								return (
									<td
										key={doc.key}
										aria-label={`${map}, ${doc.name}: ${relevant ? count : 0}`}
										className={cn(
											"rounded text-center tabular-nums",
											relevant
												? "bg-brand/15 font-semibold text-brand group-hover:bg-brand/25"
												: "bg-surface-raised/25",
										)}
									>
										<span aria-hidden>{relevant ? count : ""}</span>
									</td>
								);
							})}
						</tr>
					))}
				</tbody>
			</table>
			<div className="mt-3 flex justify-between text-[11px] text-subtle-foreground">
				<span>Possible spawns, not guaranteed pickups.</span>
				<a href={locations.corroboratingSourceUrl} target="_blank" rel="noreferrer" className="hover:text-brand">
					Spawn guides ↗
				</a>
			</div>
		</div>
	);
}

export function BattlePassPage() {
	const [progress, update] = useBattlePass();
	const [scope, setScope] = useState<"goals" | "all">("goals");
	const [cumulative, setCumulative] = useState(false);
	const [useClassified, setUseClassified] = useState(false);
	const [showMaps, setShowMaps] = useState(false);
	const [documentsOpen, setDocumentsOpen] = useState(true);
	const plan = useMemo(
		() =>
			planGoals(
				scope === "all" ? tiles.map((tile) => tile.id) : progress.goals,
				progress.completed,
				pages,
				progress.avoidedDocuments,
			),
		[progress.goals, progress.completed, progress.avoidedDocuments, scope],
	);
	const coverage = useMemo(
		() => coverCosts(plan.costs, progress.inventory, progress.classified, useClassified, progress.avoidedDocuments),
		[plan.costs, progress.inventory, progress.classified, useClassified, progress.avoidedDocuments],
	);
	const cumulativeCosts = useMemo(
		() =>
			cumulative
				? new Map(
						tiles.map((tile) => [
							tile.id,
							planGoals([tile.id], progress.completed, pages, progress.avoidedDocuments).costs,
						]),
					)
				: new Map<string, Costs>(),
		[cumulative, progress.completed, progress.avoidedDocuments],
	);
	const complete = new Set(progress.completed);
	const goals = new Set(progress.goals);
	const filler = new Set(plan.fillerIds);
	const selected = new Set(plan.selected.map((tile) => tile.id));
	const openPages = unlockedPages(progress.completed);
	const completedCount = tiles.filter((tile) => complete.has(tile.id)).length;
	const remainingTotal = tiles
		.filter((tile) => !complete.has(tile.id))
		.reduce((n, tile) => n + tile.totalDocumentCost, 0);
	const knownGoals = tiles.filter((tile) => goals.has(tile.id));
	return (
		<main
			className={cn("container mx-auto space-y-6 px-4 py-8 sm:px-6", styles.main, documentsOpen && styles.panelOpen)}
		>
			<div
				className={styles.documentDock}
				onKeyDown={(event) => {
					if (event.key === "Escape") {
						setDocumentsOpen(false);
						event.currentTarget.querySelector("button")?.focus();
					}
				}}
			>
				<button
					type="button"
					className={styles.dockToggle}
					aria-label={documentsOpen ? "Close document panel" : "Open document panel"}
					aria-expanded={documentsOpen}
					aria-controls="floating-documents"
					onClick={() => setDocumentsOpen(!documentsOpen)}
				>
					{documentsOpen ? <X size={20} /> : <FileText size={20} />}
				</button>
				{documentsOpen && (
					<aside id="floating-documents" aria-labelledby="floating-documents-heading" className={styles.documentPanel}>
						<h2 id="floating-documents-heading" className="pr-10 text-sm font-semibold">
							Documents
						</h2>
						<p className="mt-1 text-xs text-muted-foreground">
							{scope === "all" ? "Everything" : "Selected goals"} · {coverage.missing} to collect
						</p>
						<div className="mt-4 grid grid-cols-[40px_1fr_64px_36px] items-center gap-x-2 gap-y-1">
							<span className="invisible" aria-hidden>
								Doc
							</span>
							<span className="text-right text-[11px] text-muted-foreground">Need</span>
							<span className="text-center text-[11px] text-muted-foreground">Owned</span>
							<span className="invisible" aria-hidden>
								Collect
							</span>
							{documents.map((doc) => {
								const row = coverage.rows.find((row) => row.key === doc.key)!;
								const avoided = progress.avoidedDocuments.includes(doc.key);
								return (
									<div key={doc.key} className="contents">
										<DocumentChip doc={doc} end />
										<span
											aria-label={doc.name + " still needed"}
											className={cn(
												"text-right text-sm tabular-nums",
												row.missing > 0 ? "text-brand" : "text-muted-foreground",
											)}
										>
											{row.missing}
										</span>
										<input
											type="number"
											min={0}
											max={99999}
											step={1}
											inputMode="numeric"
											aria-label={doc.name + " owned"}
											className="h-9 w-full rounded bg-surface-raised text-center text-sm tabular-nums outline-brand"
											value={progress.inventory[doc.key] ?? 0}
											onChange={(event) =>
												update((current) => ({
													...current,
													inventory: { ...current.inventory, [doc.key]: normalizeCount(Number(event.target.value)) },
												}))
											}
										/>
										<ActionChip
											active={!avoided}
											tone={avoided ? "avoid" : "done"}
											label={avoided ? "Use classified" : "Collect"}
											accessibleLabel={(avoided ? "Enable" : "Disable") + " collecting " + doc.name}
											icon={avoided ? <Ban size={17} /> : <Check size={17} />}
											onClick={() =>
												update((current) => ({
													...current,
													avoidedDocuments: toggleId(current.avoidedDocuments, doc.key),
												}))
											}
										/>
									</div>
								);
							})}
							<DocumentChip doc={{ name: "Classified · wildcard 1:1" }} end />
							<span
								aria-label="Classified documents still needed"
								className="text-right text-sm tabular-nums text-special"
							>
								{coverage.classifiedMissing}
							</span>
							<input
								type="number"
								min={0}
								max={99999}
								step={1}
								inputMode="numeric"
								aria-label="Classified documents owned"
								className="h-9 w-full rounded bg-special/10 text-center text-sm tabular-nums outline-brand"
								value={progress.classified}
								onChange={(event) =>
									update((current) => ({ ...current, classified: normalizeCount(Number(event.target.value)) }))
								}
							/>
						</div>
						<div className="mt-4 space-y-3 border-t border-border pt-3 text-xs">
							<label className="flex cursor-pointer items-center gap-2">
								<input
									type="checkbox"
									className="accent-brand"
									checked={useClassified}
									onChange={(event) => setUseClassified(event.target.checked)}
								/>
								Use classified
							</label>
							<label className="flex cursor-pointer items-center gap-2">
								<input
									type="checkbox"
									className="accent-brand"
									checked={cumulative}
									onChange={(event) => setCumulative(event.target.checked)}
								/>
								Cumulative costs
							</label>
							<p className="text-[11px] leading-relaxed text-muted-foreground">
								Disabled types use classified for shortages. Preferences only break equal-cost ties. Use classified
								applies your owned wildcard balance.
							</p>
						</div>
					</aside>
				)}
			</div>
			<header className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<p className="mb-1 text-[11px] font-medium uppercase tracking-[0.18em] text-brand">Season 1 · KORD Breach</p>
					<h1 className="text-3xl font-semibold tracking-tight">Battle Pass</h1>
				</div>
				<div className="text-right text-xs text-muted-foreground">
					<p>
						<span className="text-lg font-semibold text-foreground">{completedCount}</span> / 53 claimed
					</p>
					<p>{remainingTotal} docs remaining</p>
				</div>
			</header>
			<div
				className="h-1 overflow-hidden rounded bg-surface-raised"
				role="progressbar"
				aria-label="Battle pass completion"
				aria-valuenow={completedCount}
				aria-valuemin={0}
				aria-valuemax={53}
			>
				<div className="h-full bg-success" style={{ width: `${(completedCount / 53) * 100}%` }} />
			</div>

			<section aria-labelledby="inventory-heading" className="space-y-3">
				<div className="flex items-center justify-between">
					<h2 id="inventory-heading" className="text-sm font-medium">
						Document locations
					</h2>
					<Button
						variant="ghost"
						aria-expanded={showMaps}
						aria-controls="document-map-grid"
						onClick={() => setShowMaps(!showMaps)}
					>
						<MapIcon size={15} />
						Map overlaps
						<ChevronDown size={13} className={cn("transition-transform", showMaps && "rotate-180")} />
					</Button>
				</div>
				{showMaps && (
					<div id="document-map-grid">
						<MapGrid />
					</div>
				)}
			</section>

			<section aria-labelledby="plan-heading" className="space-y-4 rounded-lg bg-card p-4">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="flex items-center gap-3">
						<h2 id="plan-heading" className="sr-only">
							Document plan
						</h2>
						<div className="flex gap-1">
							<Button
								variant="ghost"
								selected={scope === "goals"}
								aria-pressed={scope === "goals"}
								onClick={() => setScope("goals")}
							>
								Goals {knownGoals.length > 0 && `· ${knownGoals.length}`}
							</Button>
							<Button
								variant="ghost"
								selected={scope === "all"}
								aria-pressed={scope === "all"}
								onClick={() => setScope("all")}
							>
								Everything
							</Button>
						</div>
					</div>
					<label
						className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground"
						title="Allocate owned classified documents once across this plan after ordinary inventory."
					>
						<input
							type="checkbox"
							className="accent-brand"
							checked={useClassified}
							onChange={(event) => setUseClassified(event.target.checked)}
						/>
						Use classified
					</label>
				</div>
				{plan.unresolvedIds.length > 0 && (
					<p role="alert" className="text-xs text-warning">
						{plan.unresolvedIds.length} saved goals unavailable; excluded from totals.
					</p>
				)}
				{plan.selected.length === 0 ? (
					<p className="text-sm text-subtle-foreground">
						{knownGoals.length > 0 || scope === "all" ? "All done." : "Flag a reward to plan your route."}
					</p>
				) : (
					<>
						<div className="flex flex-wrap items-baseline gap-x-8 gap-y-2" aria-live="polite">
							{[
								{ label: "Plan", value: plan.total },
								{ label: "Owned", value: coverage.ownedUsed },
								{ label: "Classified", value: coverage.classifiedUsed },
								{ label: "To collect", value: coverage.missing },
							].map(({ label, value }) => (
								<div key={label}>
									<span
										className={cn("mr-2 text-2xl font-semibold tabular-nums", label === "To collect" && "text-brand")}
									>
										{value}
									</span>
									<span className="text-xs text-muted-foreground">{label}</span>
								</div>
							))}
						</div>
						<details>
							<summary className="w-fit cursor-pointer text-xs text-muted-foreground">
								Breakdown · {plan.selected.length} rewards
								{plan.fillerIds.length > 0 ? ` · ${plan.fillerIds.length} suggested` : ""}
							</summary>
							<div className="mt-4 grid gap-6 xl:grid-cols-2">
								<div className="overflow-x-auto">
									<table className="w-full text-right text-xs">
										<caption className="sr-only">Plan document requirements</caption>
										<thead className="text-subtle-foreground">
											<tr>
												<th className="text-left font-normal">Document</th>
												<th className="font-normal">Need</th>
												<th className="font-normal">Owned</th>
												<th className="font-normal">Classified</th>
												<th className="font-normal">Missing</th>
											</tr>
										</thead>
										<tbody>
											{coverage.rows.map((row) => (
												<tr key={row.key}>
													<th className="py-1 text-left font-normal">
														<DocumentChip doc={documents.find((doc) => doc.key === row.key)!} />
													</th>
													<td>{row.required}</td>
													<td>{row.used}</td>
													<td className="text-special">
														{row.classified || "—"}
														{row.classifiedMissing > 0 && " (+" + row.classifiedMissing + " needed)"}
													</td>
													<td className={row.missing ? "text-warning" : "text-success"}>{row.missing}</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
								<div className="grid content-start gap-3 sm:grid-cols-2">
									{pages
										.filter((page) => page.cells.some((tile) => selected.has(tile.id)))
										.map((page) => (
											<div key={page.num}>
												<h3 className="mb-2 text-xs font-semibold text-muted-foreground">Page {page.num}</h3>
												<ul className="space-y-1">
													{page.cells
														.filter((tile) => selected.has(tile.id))
														.map((tile) => (
															<li key={tile.id} className="flex gap-2 text-xs">
																<span className="min-w-0 flex-1 truncate" title={tile.displayName}>
																	{tile.displayName}
																</span>
																{filler.has(tile.id) && <span className="text-info">Suggested</span>}
																<span className="tabular-nums text-subtle-foreground">{tile.totalDocumentCost}</span>
															</li>
														))}
												</ul>
											</div>
										))}
								</div>
							</div>
						</details>
					</>
				)}
			</section>

			<div className="flex flex-wrap items-center justify-between gap-2">
				<h2 className="text-lg font-medium">Rewards</h2>
				<label
					className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground"
					title="Cheapest path to each reward from completed progress, before inventory. Each card is an independent preview."
				>
					<Layers size={14} />
					<input
						type="checkbox"
						className="accent-brand"
						checked={cumulative}
						onChange={(event) => setCumulative(event.target.checked)}
					/>
					Cumulative costs
				</label>
			</div>
			<div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-2">
				{pages.map((page, index) => {
					const doneCount = page.cells.filter((tile) => complete.has(tile.id)).length;
					const suggestedIds = page.cells
						.filter((tile) => filler.has(tile.id) && !complete.has(tile.id))
						.map((tile) => tile.id);
					const completeTiles = (ids: string[]) =>
						update((current) => ({
							...current,
							completed: [...new Set([...current.completed, ...ids])],
						}));
					const previousDone = index > 0 ? pages[index - 1].cells.filter((tile) => complete.has(tile.id)).length : 0;
					return (
						<section
							key={page.num}
							aria-labelledby={`pass-page-${page.num}`}
							className="min-w-0 rounded-xl border border-border/60 bg-card/50 p-3 sm:p-4"
						>
							<header className="mb-3 flex flex-wrap items-center justify-between gap-2">
								<div className="flex min-w-0 items-center gap-3">
									<h2 id={`pass-page-${page.num}`} className="shrink-0 text-sm font-semibold">
										Page {String(page.num).padStart(2, "0")}
									</h2>
									{!openPages[index] && (
										<span
											title={`Claim ${page.req} rewards on page ${page.num - 1} and unlock earlier pages.`}
											className="flex items-center gap-1 text-[11px] text-subtle-foreground"
										>
											<LockKeyhole size={12} />
											{previousDone}/{page.req} on page {page.num - 1}
										</span>
									)}
								</div>
								<div className="ml-auto flex items-center gap-1">
									<span className="mr-1 text-xs tabular-nums text-subtle-foreground">
										{doneCount}/{page.cells.length}
									</span>
									<Button
										size="xs"
										variant="ghost"
										disabled={suggestedIds.length === 0}
										aria-label={`Complete suggested: Page ${page.num}`}
										onClick={() => completeTiles(suggestedIds)}
									>
										Complete suggested
									</Button>
									<Button
										size="xs"
										variant="ghost"
										disabled={doneCount === page.cells.length}
										aria-label={`Complete all: Page ${page.num}`}
										onClick={() => completeTiles(page.cells.map((tile) => tile.id))}
									>
										Complete all
									</Button>
								</div>
							</header>
							<div className="grid gap-3 sm:grid-cols-2">
								{page.cells.map((tile) => (
									<RewardCard
										key={tile.id}
										tile={tile}
										pageNumber={page.num}
										done={complete.has(tile.id)}
										goal={goals.has(tile.id)}
										filler={filler.has(tile.id)}
										costs={cumulative ? (cumulativeCosts.get(tile.id) ?? {}) : tile.cost}
										toggleGoal={() => update((current) => ({ ...current, goals: toggleId(current.goals, tile.id) }))}
										toggleDone={() =>
											update((current) => ({ ...current, completed: toggleId(current.completed, tile.id) }))
										}
									/>
								))}
							</div>
						</section>
					);
				})}
			</div>
			<footer className="flex justify-between py-4 text-[11px] text-subtle-foreground">
				<span>Saved locally · Shared across modes</span>
				<a
					href="https://tarkov-market.com/season-1/battle-pass"
					target="_blank"
					rel="noreferrer"
					className="hover:text-brand"
				>
					Source ↗
				</a>
			</footer>
		</main>
	);
}
