"use client";

import { Compass, GitBranch, History, PanelTopClose, PanelTopOpen, Search, SlidersHorizontal, Upload, X } from "lucide-react";
import { useState } from "react";
import type { FullQuest } from "@/types/quests";
import { useUIStore } from "@/lib/stores/useUIStore";
import { cn } from "@/lib/utils";
import { QuestSyncDialog } from "../components/QuestSyncDialog";
import { QuestLogImportDialog } from "../components/QuestLogImportDialog";
import { ENABLE_MANUAL_QUEST_SYNC } from "../quest-feature-flags";
import { useQuestWorkspace } from "./QuestWorkspaceContext";

export function QuestActionBar({ quests }: { quests: FullQuest[] }) {
    const {
        searchQuery,
        setSearchQuery,
        mode,
        setMode,
        listMode,
        setListMode,
        showQuestVisualizerIndex,
    } = useQuestWorkspace();
    const isMainNavHidden = useUIStore((state) => state.isMainNavHidden);
    const setMainNavHidden = useUIStore((state) => state.setMainNavHidden);
    const [searchOpen, setSearchOpen] = useState(false);
    const [syncOpen, setSyncOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    return (
        <>
            <div data-quest-action-bar className="hidden min-h-14 items-center gap-2 bg-[var(--card-bg)] px-4 lg:flex">
                <button
                    type="button"
                    aria-pressed={isMainNavHidden}
                    onClick={() => setMainNavHidden(!isMainNavHidden)}
                    className="inline-flex items-center gap-2 border border-highlight/8 bg-highlight/3 px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-highlight/20 hover:text-foreground"
                >
                    {isMainNavHidden ? <PanelTopOpen size={14} /> : <PanelTopClose size={14} />}
                    <span className="hidden sm:inline">{isMainNavHidden ? "Show Nav" : "Hide Nav"}</span>
                </button>
                <button
                    type="button"
                    aria-pressed={listMode === "history"}
                    onClick={() => setListMode(listMode === "history" ? "quests" : "history")}
                    className={cn(
                        "inline-flex items-center gap-2 border px-3 py-2 text-xs transition-colors",
                        listMode === "history"
                            ? "border-brand/40 bg-brand/10 text-brand"
                            : "border-highlight/8 bg-highlight/3 text-muted-foreground hover:border-highlight/20 hover:text-foreground",
                    )}
                >
                    <History size={14} /> <span className="hidden sm:inline">History</span>
                </button>
                {searchOpen ? (
                    <div className="flex min-w-0 flex-1 items-center gap-2 border-b border-brand/50 px-1 py-1.5">
                        <Search size={15} className="text-subtle-foreground" />
                        <input autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search quests, traders, objectives…" className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-subtle-foreground" />
                        <button type="button" aria-label="Close search" onClick={() => { setSearchOpen(false); setSearchQuery(""); }} className="text-subtle-foreground hover:text-foreground"><X size={14} /></button>
                    </div>
                ) : (
                    <button type="button" onClick={() => setSearchOpen(true)} className="inline-flex items-center gap-2 border border-highlight/8 bg-highlight/3 px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-highlight/20 hover:text-foreground"><Search size={14} /> Search</button>
                )}
                {!searchOpen && <div className="flex-1" />}
                {ENABLE_MANUAL_QUEST_SYNC && (
                    <button type="button" onClick={() => setSyncOpen(true)} className="hidden items-center gap-2 border border-highlight/8 bg-highlight/3 px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-highlight/20 hover:text-foreground sm:inline-flex"><SlidersHorizontal size={14} /> Sync</button>
                )}
                <button type="button" onClick={() => setImportOpen(true)} className="inline-flex items-center gap-2 border border-highlight/8 bg-highlight/3 px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-highlight/20 hover:text-foreground"><Upload size={14} /> <span className="hidden sm:inline">Upload</span></button>
                <button type="button" aria-pressed={mode === "visualizer"} onClick={() => mode === "visualizer" ? setMode("details") : showQuestVisualizerIndex()} className={cn("inline-flex items-center gap-2 border px-3 py-2 text-xs font-semibold transition-colors", mode === "visualizer" ? "border-brand/50 bg-brand/12 text-brand" : "border-highlight/8 bg-highlight/3 text-foreground hover:border-brand/35 hover:text-brand")}><GitBranch size={15} /> Visualizer</button>
                <button type="button" aria-pressed={mode === "planner"} onClick={() => setMode(mode === "planner" ? "details" : "planner")} className={cn("inline-flex items-center gap-2 border px-3 py-2 text-xs font-semibold transition-colors", mode === "planner" ? "border-brand/50 bg-brand/12 text-brand" : "border-highlight/8 bg-highlight/3 text-foreground hover:border-brand/35 hover:text-brand")}><Compass size={15} /> Raid planner</button>
            </div>
            {ENABLE_MANUAL_QUEST_SYNC && (
                <QuestSyncDialog open={syncOpen} onOpenChange={setSyncOpen} />
            )}
            <QuestLogImportDialog open={importOpen} onOpenChange={setImportOpen} quests={quests} />
        </>
    );
}
