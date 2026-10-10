"use client";
/// <reference types="react/canary" />
import { addTransitionType, startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { coverCosts, pages, planGoals, tiles, unlockedPages, type Costs } from "./lib/battle-pass-model";
import { useBattlePass } from "./useBattlePass";
import { DocumentDock } from "./components/DocumentDock";
import { BattlePassOverview } from "./components/BattlePassOverview";
import { PageNavigation } from "./components/PageNavigation";
import { PageMinimap } from "./components/PageMinimap";
import { RewardPage } from "./components/RewardPage";
import { cn } from "@/lib/utils";

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

export function BattlePassPage() {
	const [progress, update] = useBattlePass();
	const [scope, setScope] = useState<"goals" | "all">("goals");
	const [cumulative, setCumulative] = useState(false);
	const [useClassified, setUseClassified] = useState(false);
	const [showMaps, setShowMaps] = useState(false);
	const [documentsOpen, setDocumentsOpen] = useState(false);
	const [start, setStart] = useState(0);
	const [listMode, setListMode] = useState(false);
	const spread = useSpread();
	const lastStart = Math.max(0, pages.length - spread);
	const first = Math.min(start, lastStart);
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
	const visible = listMode ? pages : pages.slice(first, first + spread);
	return (
		<main className={cn("container mx-auto space-y-4 px-4 pt-6 sm:px-6", listMode ? "pb-8" : "pb-28")}>
			<DocumentDock {...{ documentsOpen, setDocumentsOpen, progress, update, coverage, scope, plan }} />

			<BattlePassOverview
				{...{
					scope,
					setScope,
					knownGoals,
					useClassified,
					setUseClassified,
					cumulative,
					setCumulative,
					listMode,
					setListMode,
					showMaps,
					setShowMaps,
					completedCount,
					remainingTotal,
					plan,
					coverage,
					selected,
					filler,
				}}
			/>

			{!listMode && <PageNavigation {...{ first, lastStart, go }} />}
			<div
				className={cn(
					"grid items-start",
					listMode ? "gap-x-8 gap-y-10 lg:grid-cols-2" : cn("gap-4", spread === 2 && "grid-cols-2"),
				)}
			>
				{visible.map((page) => (
					<RewardPage
						key={page.num}
						{...{ page, complete, goals, filler, openPages, cumulative, cumulativeCosts, update }}
					/>
				))}
			</div>

			{!listMode && <PageMinimap {...{ first, spread, complete, goals, openPages, go }} />}

			<footer className="flex justify-end py-4 text-[11px] text-subtle-foreground">
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
