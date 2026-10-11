"use client";
/// <reference types="react/canary" />
import { addTransitionType, startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { Map as MapIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { coverCosts, pages, planGoals, tiles, unlockedPages, type Costs } from "./lib/battle-pass-model";
import { useBattlePass } from "./useBattlePass";
import { DocumentDock } from "./components/DocumentDock";
import { BattlePassOverview } from "./components/BattlePassOverview";
import { PageNavigation } from "./components/PageNavigation";
import { BattlePassToolbar } from "./components/BattlePassToolbar";
import { LocationsPanel } from "./components/LocationsPanel";
import { PageMinimap } from "./components/PageMinimap";
import { RewardPage } from "./components/RewardPage";
import { ConsumeDocumentsToggle } from "./components/ConsumeDocumentsToggle";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const BattlePassMapView = dynamic(
	() => import("./components/BattlePassMapView").then((module) => module.BattlePassMapView),
	{
		ssr: false,
		loading: () => (
			<div className="flex h-full flex-col items-center justify-center gap-4 p-6">
				<p role="status" className="text-sm text-muted-foreground">
					Loading document map…
				</p>
				<DialogClose asChild>
					<Button>Back to Battle Pass</Button>
				</DialogClose>
			</div>
		),
	},
);

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
	const [progress, update, { completeTiles, toggleTile, consumeDocs, setConsumeDocs }] = useBattlePass();
	const [requestedScope, setScope] = useState<"goals" | "all">("goals");
	const scope = progress.goals.length === 0 ? "all" : requestedScope;
	const [cumulative, setCumulative] = useState(false);
	const [useClassified, setUseClassified] = useState(false);
	const [showMaps, setShowMaps] = useState(false);
	const [mapOpen, setMapOpen] = useState(false);
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
		if (listMode || mapOpen) return;
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
	}, [first, go, listMode, mapOpen]);
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
		<Dialog open={mapOpen} onOpenChange={setMapOpen}>
			<main className={cn("container mx-auto space-y-4 px-4 pt-6 sm:px-6", listMode ? "pb-8" : "pb-28")}>
				<DocumentDock
					{...{ documentsOpen, setDocumentsOpen, progress, update, coverage, scope, plan, consumeDocs, setConsumeDocs }}
				/>

				<BattlePassOverview
					{...{ scope, knownGoals, completedCount, remainingTotal, plan, coverage, selected, filler }}
					headerAction={
						<DialogTrigger asChild>
							<Button tone="brand">
								<MapIcon size={15} aria-hidden />
								Document map
							</Button>
						</DialogTrigger>
					}
				>
					<BattlePassToolbar
						goalCount={knownGoals.length}
						{...{
							scope,
							setScope,
							useClassified,
							setUseClassified,
							cumulative,
							setCumulative,
							listMode,
							setListMode,
							showMaps,
							setShowMaps,
						}}
					/>
				</BattlePassOverview>
				{showMaps && (
					<div id="document-locations-panel">
						<LocationsPanel />
					</div>
				)}

				<div className="grid items-center gap-2 md:grid-cols-[1fr_auto_1fr]">
					{!listMode && (
						<div className="md:col-start-2">
							<PageNavigation {...{ first, lastStart, go }} />
						</div>
					)}
					<div className="justify-self-end md:col-start-3">
						<ConsumeDocumentsToggle checked={consumeDocs} onChange={setConsumeDocs} />
					</div>
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
							{...{
								page,
								complete,
								goals,
								filler,
								openPages,
								cumulative,
								cumulativeCosts,
								update,
								completeTiles,
								toggleTile,
							}}
							inventory={progress.inventory}
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
			<DialogContent
				className="inset-0 top-0 left-0 h-dvh max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-none border-0 shadow-none data-[state=open]:animate-none data-[state=closed]:animate-none"
				showCloseButton={false}
				aria-describedby={undefined}
			>
				<DialogTitle className="sr-only">Battle pass document map</DialogTitle>
				<BattlePassMapView onClose={() => setMapOpen(false)} />
			</DialogContent>
		</Dialog>
	);
}
