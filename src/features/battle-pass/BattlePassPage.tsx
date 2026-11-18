"use client";
import { useBattlePassData, useBattlePassSave } from "./BattlePassSeason";

/// <reference types="react/canary" />
import { addTransitionType, startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSeason } from "@/lib/cfg/seasons";
import { Button } from "@/components/ui/button";
import { Toggle } from "./components/ui/Toggle";
import { parseProgress, selectGoalRewards, toggleId, unlockedPages } from "./lib/battle-pass-model";
import { useBattlePassPreferences } from "./useBattlePassPreferences";
import { PageNavigation } from "./components/PageNavigation";
import { PageMinimap } from "./components/PageMinimap";
import { RewardPage } from "./components/RewardPage";
import { cn } from "@/lib/utils";
import { battlePassSpreadStart } from "./lib/battle-pass-page-link";

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
	const { pages, tiles, seasonId } = useBattlePassData();
	const { stored: progress, write } = useBattlePassSave();
	const [{ listMode, requestedScope }, setPreference] = useBattlePassPreferences();
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
			if (event.ctrlKey || event.metaKey || event.altKey) return;
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
	const displayedTotal = scope === "goals" ? goalTotal : remainingTotal;
	const visible = listMode ? pages : pages.slice(first, first + spread);
	return (
		<main className={cn("container mx-auto space-y-4 px-4 pt-6 sm:px-6", listMode ? "pb-8" : "pb-28")}>
			<section aria-label="Battle pass overview" className="space-y-3 rounded-xl bg-card p-4">
				<p className="text-xs uppercase tracking-widest text-brand">{getSeason(seasonId).title}</p>
				<h1 className="text-2xl font-semibold">Battle Pass</h1>
				<p aria-live="polite">
					{completedCount} / {tiles.length} rewards claimed &middot; {displayedTotal}{" "}
					{displayedTotal === 1 ? "document" : "documents"} for{" "}
					{scope === "goals" ? "remaining goals and prerequisites" : "unclaimed rewards"}
				</p>
				<div className="flex flex-wrap items-center gap-2">
					<Button
						size="xs"
						variant="ghost"
						selected={scope === "all"}
						aria-pressed={scope === "all"}
						onClick={() => setPreference("requestedScope", "all")}
					>
						Everything
					</Button>
					<Button
						size="xs"
						variant="ghost"
						disabled={!progress.goals.length}
						selected={scope === "goals"}
						aria-pressed={scope === "goals"}
						onClick={() => setPreference("requestedScope", "goals")}
					>
						Goals
					</Button>
					<Toggle checked={listMode} onChange={(checked) => setPreference("listMode", checked)}>
						List view
					</Toggle>
				</div>
				{plan.unresolvedIds.length > 0 && (
					<p role="alert">{plan.unresolvedIds.length} saved goals unavailable; excluded from totals.</p>
				)}
			</section>
			{!listMode && (
				<div className="flex justify-center">
					<PageNavigation {...{ first, lastStart, go }} />
				</div>
			)}
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
						toggleGoal={(id) => updateIds("goals", (ids) => toggleId(ids, id))}
						toggleTile={(id) => updateIds("completed", (ids) => toggleId(ids, id))}
						completeTiles={(added) => updateIds("completed", (ids) => [...new Set([...ids, ...added])])}
					/>
				))}
			</div>

			{!listMode && <PageMinimap {...{ first, spread, complete, goals, openPages, go }} possibleProgress={[]} />}
		</main>
	);
}
