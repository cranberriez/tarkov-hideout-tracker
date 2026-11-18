"use client";
import { useBattlePassData, useBattlePassSave } from "./BattlePassSeason";

/// <reference types="react/canary" />
import { addTransitionType, startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSeason } from "@/lib/cfg/seasons";
import { Button } from "@/components/ui/button";
import { Check, CircleAlert, CircleCheck, Info, SlidersHorizontal } from "lucide-react";
import { parseProgress, selectGoalRewards, toggleId, unlockedPages } from "./lib/battle-pass-model";
import { useBattlePassPreferences } from "./useBattlePassPreferences";
import { PageNavigation } from "./components/PageNavigation";
import { PageMinimap } from "./components/PageMinimap";
import { BattlePassSummary } from "./components/BattlePassSummary";
import { RewardPage } from "./components/RewardPage";
import { cn } from "@/lib/utils";
import { battlePassSpreadStart } from "./lib/battle-pass-page-link";
import { useBattlePassConfiguration } from "./useBattlePassConfiguration";
import { configuredPlan, rewardCostStatus } from "./lib/battle-pass-configuration";
import { DocumentRoutePanel } from "./components/DocumentRoutePanel";
import { LocationsPanel } from "./components/LocationsPanel";
import { DocumentInventoryPanel } from "./components/DocumentInventoryPanel";
import { useDocumentRouteController } from "./useDocumentRouteController";
import { Toggle } from "./components/ui/Toggle";
import { useDocumentInventory } from "./useDocumentInventory";

function headerControlClass(selected: boolean) {
	return cn(
		"h-10 rounded-md border-transparent px-4 text-sm font-medium hover:border-transparent",
		selected
			? "bg-brand/15 text-brand hover:bg-brand/20"
			: "bg-surface-raised/50 text-muted-foreground hover:bg-surface-raised hover:text-foreground",
	);
}

function useSpread() {
	const [spread, setSpread] = useState(2);
	useEffect(() => {
		const query = window.matchMedia("(min-width: 1100px)");
		const sync = () => setSpread(query.matches ? 2 : 1);
		sync();
		query.addEventListener("change", sync);
		return () => query.removeEventListener("change", sync);
	}, []);
	return spread;
}

export function BattlePassPage({ initialPage }: { initialPage?: number }) {
	const { pages, tiles, seasonId, documentKeys } = useBattlePassData();
	const costSetup = useBattlePassConfiguration(seasonId, tiles);
	const documentInventory = useDocumentInventory();
	const { stored: progress, write } = useBattlePassSave();
	const [{ listMode, requestedScope, showProfileRecommendations, optimizerEnabled }, setPreference] =
		useBattlePassPreferences();
	const route = useDocumentRouteController(
		documentInventory,
		costSetup.configuration,
		optimizerEnabled && !costSetup.editing,
	);
	const recommendedProfiles = new Map(
		optimizerEnabled &&
			showProfileRecommendations &&
			!costSetup.editing &&
			typeof route.result !== "string" &&
			route.result
			? route.result.claims.map(
					(claim) =>
						[claim.rewardId, documentInventory.profiles.find((profile) => profile.key === claim.profileKey)] as const,
				)
			: [],
	);
	const scope = progress.goals.length ? requestedScope : "all";
	const updateIds = (field: "completed" | "goals", transform: (ids: string[]) => string[]) =>
		write((raw) => {
			const stored = parseProgress(raw);
			let saved;
			try {
				saved = JSON.parse(raw ?? "{}");
			} catch {
				saved = {};
			}
			return JSON.stringify({ version: 1, ...saved, [field]: transform(stored[field]) });
		});
	const [start, setStart] = useState((initialPage ?? 1) - 1);
	const pendingPage = useRef(initialPage);
	const spread = useSpread();
	const lastStart = Math.max(0, pages.length - spread);
	const first = Math.min(start, lastStart);
	useEffect(() => {
		const target = pendingPage.current;
		if (target === undefined || (!listMode && first !== battlePassSpreadStart(target, pages.length, spread))) return;
		const frame = requestAnimationFrame(() => {
			const heading = document.getElementById(`pass-page-${target}`);
			if (heading) {
				heading.scrollIntoView({ block: "start" });
				pendingPage.current = undefined;
			}
		});
		return () => cancelAnimationFrame(frame);
	}, [initialPage, first, listMode, spread, pages.length]);
	const go = useCallback(
		(to: number) => {
			const next = Math.max(0, Math.min(to, lastStart));
			if (next === first) return;
			startTransition(() => {
				addTransitionType(next > first ? "page-next" : "page-prev");
				setStart(next);
			});
		},
		[first, lastStart],
	);
	useEffect(() => {
		if (listMode) return;
		const onKey = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			if (
				event.ctrlKey ||
				event.metaKey ||
				event.altKey ||
				(event.target instanceof Element && event.target.closest('[role="menu"]'))
			)
				return;
			if (target?.closest("input, textarea, select, [contenteditable]")) return;
			const key = event.key.toLowerCase();
			if (key === "q" || key === "arrowleft") go(first - 1);
			else if (key === "e" || key === "arrowright") go(first + 1);
			else return;
			event.preventDefault();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [first, go, listMode]);
	const plan = useMemo(
		() => selectGoalRewards(progress.goals, progress.completed, pages),
		[progress.goals, progress.completed, pages],
	);
	const complete = new Set(progress.completed);
	const goals = new Set(progress.goals);
	const filler = new Set(scope === "goals" ? plan.fillerIds : []);
	const openPages = unlockedPages(progress.completed, pages);
	const completedCount = tiles.filter((tile) => complete.has(tile.id)).length;
	const remainingTotal = tiles
		.filter((tile) => !complete.has(tile.id))
		.reduce((n, tile) => n + tile.totalDocumentCost, 0);
	const goalTotal = plan.selected.reduce((sum, tile) => sum + tile.totalDocumentCost, 0);
	const visible = listMode ? pages : pages.slice(first, first + spread);
	const required = scope === "goals" ? plan.selected : tiles.filter((tile) => !complete.has(tile.id));
	const configurationStatus = configuredPlan(
		required,
		costSetup.configuration,
		documentKeys,
		scope === "goals" ? plan.unresolvedIds : [],
	);
	return (
		<main className={cn("container mx-auto space-y-4 px-4 pt-6 sm:px-6", listMode ? "pb-8" : "pb-28")}>
			<section
				aria-label="Battle pass overview"
				className="grid items-center gap-5 rounded-xl bg-card p-4 lg:grid-cols-2 lg:gap-8"
			>
				<div className="space-y-3">
					<p className="text-xs uppercase tracking-widest text-brand">{getSeason(seasonId).title}</p>
					<h1 className="text-2xl font-semibold">Battle Pass</h1>
					<p aria-live="polite">
						{completedCount} / {tiles.length} rewards claimed
					</p>
					<div className="flex flex-wrap items-center gap-2">
						<div role="group" aria-label="Plan scope" className="flex flex-wrap items-center gap-2">
							<span className="text-sm text-muted-foreground">Plan</span>
							<Button
								size="md"
								variant="soft"
								className={headerControlClass(scope === "all")}
								selected={scope === "all"}
								aria-pressed={scope === "all"}
								onClick={() => setPreference("requestedScope", "all")}
							>
								Everything
							</Button>
							<Button
								size="md"
								variant="soft"
								className={headerControlClass(scope === "goals")}
								disabled={!progress.goals.length}
								selected={scope === "goals"}
								aria-pressed={scope === "goals"}
								onClick={() => setPreference("requestedScope", "goals")}
							>
								Goals
							</Button>
						</div>
						<span aria-hidden className="mx-1 h-5 w-px bg-border" />
						<Button
							size="md"
							variant="soft"
							className={headerControlClass(listMode)}
							selected={listMode}
							aria-pressed={listMode}
							onClick={() => setPreference("listMode", !listMode)}
						>
							List view
						</Button>
						<Toggle
							disabled={!optimizerEnabled}
							title={optimizerEnabled ? undefined : "Enable the docs optimizer to see recommendations"}
							checked={optimizerEnabled && showProfileRecommendations}
							onChange={(value) => setPreference("showProfileRecommendations", value)}
						>
							Profile recommendations
						</Toggle>
					</div>
					{plan.unresolvedIds.length > 0 && (
						<p role="alert">{plan.unresolvedIds.length} saved goals unavailable; excluded from totals.</p>
					)}
				</div>
				<BattlePassSummary
					endsAt={getSeason(seasonId).endsAt}
					goalTotal={progress.goals.length ? goalTotal : null}
					remainingTotal={remainingTotal}
				/>
			</section>
			<DocumentInventoryPanel
				inventory={documentInventory}
				costs={costSetup.editing ? null : configurationStatus.costs}
			/>
			<LocationsPanel />
			<div
				className={cn(
					"flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3",
					costSetup.editing
						? "bg-card text-foreground"
						: configurationStatus.ready && !costSetup.error
							? "bg-card text-muted-foreground"
							: "bg-warning/10 text-warning",
				)}
				style={
					costSetup.editing && (!configurationStatus.ready || costSetup.error)
						? {
								backgroundImage:
									"linear-gradient(90deg, color-mix(in oklab, var(--danger) 14%, transparent), transparent 20%)",
							}
						: undefined
				}
			>
				<div className="min-w-0 flex-1 basis-full space-y-1 sm:basis-0">
					{costSetup.editing ? (
						<p className="flex items-start gap-2 text-sm" role={costSetup.error ? "alert" : "status"}>
							{configurationStatus.ready && !costSetup.error ? (
								<CircleCheck size={16} className="mt-0.5 shrink-0 text-success" aria-hidden />
							) : (
								<CircleAlert size={16} className="mt-0.5 shrink-0 text-danger" aria-hidden />
							)}
							{costSetup.error ||
								(configurationStatus.ready
									? `Costs configured for ${scope === "goals" ? "your goals and prerequisites" : "all unclaimed rewards"}.`
									: scope === "goals" && plan.unresolvedIds.length > 0
										? "Some saved goals are unavailable. Resolve them to validate goal costs."
										: `${configurationStatus.missingIds.length} ${configurationStatus.missingIds.length === 1 ? "reward needs" : "rewards need"} costs for ${scope === "goals" ? "your goals and prerequisites" : "Everything"}.`)}
						</p>
					) : (
						<p className="flex items-start gap-2 text-sm">
							<Info size={16} className="mt-0.5 shrink-0" aria-hidden />
							The document types required for each reward vary between players.
							{costSetup.usingDefaults && " (Defaults may be wrong for you.)"}
						</p>
					)}
					{!costSetup.editing && costSetup.error && (
						<p role="alert" className="text-sm text-danger">
							{costSetup.error}
						</p>
					)}
				</div>
				{costSetup.editing ? (
					<div className="flex gap-2">
						<Button variant="solid" onClick={costSetup.save}>
							Save
						</Button>
						<Button variant="soft" onClick={costSetup.cancel}>
							Cancel
						</Button>
					</div>
				) : (
					<div className="flex gap-2">
						<Button
							variant="soft"
							size="sm"
							className="border-transparent hover:border-transparent"
							aria-pressed={costSetup.usingDefaults}
							onClick={costSetup.toggleDefaults}
						>
							{costSetup.usingDefaults && <Check size={14} aria-hidden />}
							Use Defaults
						</Button>
						<Button variant="solid" size="sm" onClick={costSetup.begin}>
							<SlidersHorizontal size={14} aria-hidden />
							Setup Costs
						</Button>
					</div>
				)}
			</div>

			<div
				className={cn(
					"grid items-start",
					listMode ? "gap-x-8 gap-y-10 lg:grid-cols-2" : cn("gap-4", spread === 2 && "grid-cols-2"),
				)}
			>
				{visible.map((page) => (
					<RewardPage
						key={page.num}
						{...{ page, complete, goals, filler, openPages }}
						costSetup={costSetup}
						recommendedProfiles={recommendedProfiles}
						toggleGoal={(id) => updateIds("goals", (ids) => toggleId(ids, id))}
						toggleTile={(id) => documentInventory.claim([id], true)}
						completeTiles={(added) => documentInventory.claim(added)}
					/>
				))}
			</div>

			{!listMode && (
				<div className="flex justify-center">
					<PageNavigation {...{ first, lastStart, go }} />
				</div>
			)}
			{!costSetup.editing && (
				<DocumentRoutePanel
					inventory={documentInventory}
					route={route}
					enabled={optimizerEnabled}
					onEnabledChange={(value) => setPreference("optimizerEnabled", value)}
				/>
			)}
			{!listMode && (
				<PageMinimap
					{...{ first, spread, complete, goals, openPages, go }}
					possibleProgress={[]}
					unsetPages={
						new Set(
							pages
								.filter((page) =>
									page.cells.some(
										(tile) =>
											!complete.has(tile.id) &&
											!rewardCostStatus(tile, costSetup.configuration[tile.id], documentKeys).valid,
									),
								)
								.map((page) => page.num),
						)
					}
					errorPages={
						new Set(
							pages
								.filter((page) =>
									page.cells.some(
										(tile) =>
											!complete.has(tile.id) &&
											rewardCostStatus(tile, costSetup.configuration[tile.id], documentKeys).errors.length > 0,
									),
								)
								.map((page) => page.num),
						)
					}
				/>
			)}
		</main>
	);
}
