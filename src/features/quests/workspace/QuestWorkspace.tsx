"use client";

import { ChevronLeft } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import type { QuestWorkspaceQuest } from "@/types/quests";
import { useUIStore } from "@/lib/stores/useUIStore";
import { useModeRoute } from "@/lib/useModeRoute";
import { cn } from "@/lib/utils";
import { isQuestWorkspaceUrl } from "../quest-routes";
import { QuestDetailRoute } from "./QuestDetailRoute";
import { QuestSelectionPrompt } from "./QuestSelectionPrompt";
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

/**
 * Quest links inside the workspace select in place: a plain left click on any same-mode link to
 * the quest index or a quest pushes native history (which Next syncs to `usePathname`) instead of
 * a route navigation, so no server render or route payload is fetched. Modified clicks, new tabs,
 * direct visits and reloads still use the cached quest routes.
 */
function useInPlaceQuestLinks() {
	const { mode } = useModeRoute();
	useEffect(() => {
		function onClick(event: MouseEvent) {
			if (event.defaultPrevented || event.button !== 0) return;
			if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
			const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
			if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute("download")) return;
			if (anchor.target && anchor.target !== "_self") return;
			const url = new URL(anchor.href);
			if (url.origin !== window.location.origin || !isQuestWorkspaceUrl(url, mode)) return;
			// Capture phase: Next's Link sees the prevented default and skips its navigation; link
			// onClick handlers (selection marks, mode switches) still run.
			event.preventDefault();
			const href = `${url.pathname}${url.search}${url.hash}`;
			const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
			if (href !== current) window.history.pushState(null, "", href);
		}
		document.addEventListener("click", onClick, true);
		return () => document.removeEventListener("click", onClick, true);
	}, [mode]);
}

/**
 * Shows the routed page while it matches the URL's selection (direct visits keep their server-rendered
 * detail); after in-place selection, renders the selected quest from the workspace index plus its
 * CDN-cached detail request.
 */
function QuestDetailOutlet({ routed }: { routed: ReactNode }) {
	const { selectedQuestId, routedQuestId, questsById } = useQuestWorkspace();
	const selected = selectedQuestId ? questsById.get(selectedQuestId) : null;
	// No navigation runs for in-place selection, so keep the tab title in step with the URL
	// (same strings as the routes' metadata, including after Back to the routed quest).
	useEffect(() => {
		if (selectedQuestId && !selected) return;
		document.title = selected
			? `${selected.name} – ${selected.trader.name} Quest · Tarkov Hideout Tracker`
			: "Escape from Tarkov Quests & Required Items · Tarkov Hideout Tracker";
	}, [selected, selectedQuestId]);
	if (selectedQuestId === routedQuestId) return routed;
	return selectedQuestId ? <QuestDetailRoute key={selectedQuestId} questId={selectedQuestId} /> : <QuestSelectionPrompt />;
}

/** `children` is the routed detail outlet: the selection prompt or `/quests/[questId]`. */
export function QuestWorkspace({ quests, children }: { quests: QuestWorkspaceQuest[]; children: ReactNode }) {
	const { mode, setMode, selectedQuestId, indexHref, markInternalSelection, consumeInternalSelection } =
		useQuestWorkspace();
	const isMainNavHidden = useUIStore((state) => state.isMainNavHidden);
	useInPlaceQuestLinks();
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
							prefetch={false}
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
						<QuestDetailOutlet routed={children} />
					)}
				</section>
			</div>
			<QuestMobileMenu />
		</main>
	);
}
