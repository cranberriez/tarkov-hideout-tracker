"use client";

import {
	Columns3,
	Compass,
	GitBranch,
	History,
	PanelTopClose,
	PanelTopOpen,
	Pin,
	Search,
	Upload,
	X,
} from "lucide-react";
import { useState } from "react";
import type { QuestWorkspaceQuest } from "@/types/quests";
import { useUIStore } from "@/lib/stores/useUIStore";
import { Button } from "@/components/ui/button";
import { QuestLogImportDialog } from "../import/QuestLogImportDialog";
import { useQuestWorkspace } from "./QuestWorkspaceContext";

export function QuestActionBar({ quests }: { quests: QuestWorkspaceQuest[] }) {
	const {
		searchQuery,
		setSearchQuery,
		mode,
		setMode,
		listMode,
		setListMode,
		showQuestVisualizerIndex,
		showPinnedOnly,
		setShowPinnedOnly,
	} = useQuestWorkspace();
	const isMainNavHidden = useUIStore((state) => state.isMainNavHidden);
	const setMainNavHidden = useUIStore((state) => state.setMainNavHidden);
	const [searchOpen, setSearchOpen] = useState(false);
	const [importOpen, setImportOpen] = useState(false);
	return (
		<>
			<div data-quest-action-bar className="hidden min-h-14 items-center gap-2 bg-[var(--card-bg)] px-4 lg:flex">
				<Button aria-pressed={isMainNavHidden} onClick={() => setMainNavHidden(!isMainNavHidden)}>
					{isMainNavHidden ? <PanelTopOpen size={14} /> : <PanelTopClose size={14} />}
					<span className="hidden sm:inline">{isMainNavHidden ? "Show Nav" : "Hide Nav"}</span>
				</Button>
				<Button
					selected={listMode === "history"}
					aria-pressed={listMode === "history"}
					onClick={() => setListMode(listMode === "history" ? "quests" : "history")}
				>
					<History size={14} /> <span className="hidden sm:inline">History</span>
				</Button>
				<Button
					selected={showPinnedOnly}
					aria-pressed={showPinnedOnly}
					onClick={() => setShowPinnedOnly(!showPinnedOnly)}
				>
					<Pin size={14} /> Pinned
				</Button>
				{searchOpen ? (
					<div className="flex min-w-0 flex-1 items-center gap-2 border-b border-brand/50 px-1 py-1.5">
						<Search size={15} className="text-subtle-foreground" />
						<input
							autoFocus
							aria-label="Search quests"
							value={searchQuery}
							onChange={(event) => setSearchQuery(event.target.value)}
							placeholder="Search quests, traders, objectives…"
							className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-subtle-foreground"
						/>
						<Button
							variant="ghost"
							size="xs"
							iconOnly
							aria-label="Close search"
							onClick={() => {
								setSearchOpen(false);
								setSearchQuery("");
							}}
						>
							<X size={14} />
						</Button>
					</div>
				) : (
					<Button onClick={() => setSearchOpen(true)}>
						<Search size={14} /> Search
					</Button>
				)}
				{!searchOpen && <div className="flex-1" />}
				<Button onClick={() => setImportOpen(true)}>
					<Upload size={14} /> <span className="hidden sm:inline">Upload</span>
				</Button>
				<Button
					selected={mode === "board"}
					aria-pressed={mode === "board"}
					onClick={() => setMode(mode === "board" ? "details" : "board")}
					className={mode === "board" ? undefined : "text-foreground"}
				>
					<Columns3 size={15} /> Trader board
				</Button>
				<Button
					selected={mode === "visualizer"}
					aria-pressed={mode === "visualizer"}
					onClick={() => (mode === "visualizer" ? setMode("details") : showQuestVisualizerIndex())}
					className={mode === "visualizer" ? undefined : "text-foreground"}
				>
					<GitBranch size={15} /> Visualizer
				</Button>
				<Button
					selected={mode === "planner"}
					aria-pressed={mode === "planner"}
					onClick={() => setMode(mode === "planner" ? "details" : "planner")}
					className={mode === "planner" ? undefined : "text-foreground"}
				>
					<Compass size={15} /> Raid planner
				</Button>
			</div>
			<QuestLogImportDialog open={importOpen} onOpenChange={setImportOpen} quests={quests} />
		</>
	);
}
