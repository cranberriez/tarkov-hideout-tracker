"use client";

import { ChevronLeft } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import type { QuestWorkspaceQuest } from "@/types/quests";
import { useUIStore } from "@/lib/stores/useUIStore";
import { cn } from "@/lib/utils";
import { useQuestWorkspace } from "./QuestWorkspaceContext";

function PaneLoading() {
	return (
		<div role="status" className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
			Loading view…
		</div>
	);
}

// Keep the routed detail outlet outside these browser-only boundaries: its public
// quest content must still be present in the HTML on a direct visit.
const QuestListSurface = dynamic(() => import("./QuestListSurface").then((module) => module.QuestListSurface), {
	ssr: false,
	loading: PaneLoading,
});
const QuestActionBar = dynamic(() => import("./QuestActionBar").then((module) => module.QuestActionBar), {
	ssr: false,
});
const QuestMobileMenu = dynamic(() => import("./QuestMobileMenu").then((module) => module.QuestMobileMenu), {
	ssr: false,
});
const QuestTraderBoardPane = dynamic(
	() => import("./QuestTraderBoardPane").then((module) => module.QuestTraderBoardPane),
	{ ssr: false, loading: PaneLoading },
);
const QuestVisualizerPane = dynamic(
	() => import("./QuestVisualizerPane").then((module) => module.QuestVisualizerPane),
	{ ssr: false, loading: PaneLoading },
);

/** `children` is the routed detail outlet: the selection prompt or `/quests/[questId]`. */
export function QuestWorkspace({ quests, children }: { quests: QuestWorkspaceQuest[]; children: ReactNode }) {
	const { mode, setMode, selectedQuestId, indexHref, markInternalSelection, consumeInternalSelection } =
		useQuestWorkspace();
	const isMainNavHidden = useUIStore((state) => state.isMainNavHidden);
	useEffect(() => {
		document.body.classList.add("quest-workspace-active");
		return () => document.body.classList.remove("quest-workspace-active");
	}, []);
	// Back/Forward, search, and shared links show the selected quest's details even when the
	// visualizer is open. Workspace-initiated selection keeps the current mode.
	const previousQuestId = useRef(selectedQuestId);
	useEffect(() => {
		if (previousQuestId.current === selectedQuestId) return;
		previousQuestId.current = selectedQuestId;
		if (consumeInternalSelection(selectedQuestId) || !selectedQuestId) return;
		setMode("details");
		requestAnimationFrame(() =>
			document.getElementById(`quest-workspace-${selectedQuestId}`)?.scrollIntoView({ block: "center" }),
		);
	}, [consumeInternalSelection, selectedQuestId, setMode]);
	return (
		<main
			data-quest-workspace
			className={cn(
				"flex min-h-0 shrink-0 overflow-hidden",
				isMainNavHidden ? "h-dvh" : "h-[calc(100dvh-4rem)] sm:h-[calc(100dvh-4.75rem)]",
			)}
		>
			<div
				data-quest-workspace-grid
				className={cn(
					"grid min-h-0 flex-1 grid-cols-1 grid-rows-1 overflow-hidden bg-[var(--background)]",
					mode !== "board" && "lg:grid-cols-[clamp(380px,34vw,560px)_minmax(0,1fr)]",
				)}
			>
				<section
					className={cn(
						"min-h-0 min-w-0 flex-col border-highlight/10 lg:border-r",
						mode === "details" && !selectedQuestId ? "flex" : "hidden",
						mode !== "board" && "lg:flex",
					)}
					data-quest-list-pane
				>
					<QuestListSurface />
				</section>
				<section
					className={cn("min-h-0 min-w-0 flex-col lg:flex", mode !== "details" || selectedQuestId ? "flex" : "hidden")}
				>
					<QuestActionBar quests={quests} />
					{mode === "details" && selectedQuestId && (
						<Link
							href={indexHref}
							scroll={false}
							onClick={() => markInternalSelection(null)}
							data-quest-mobile-back-bar
							className="flex h-12 shrink-0 items-center gap-2 border-b border-highlight/10 bg-[var(--card-bg)] px-4 text-xs font-medium text-foreground transition-colors hover:text-foreground lg:hidden"
						>
							<ChevronLeft size={16} /> Back to quests
						</Link>
					)}
					{mode === "board" ? (
						<QuestTraderBoardPane />
					) : mode === "visualizer" ? (
						<QuestVisualizerPane />
					) : (
						children
					)}
				</section>
			</div>
			<QuestMobileMenu />
		</main>
	);
}
