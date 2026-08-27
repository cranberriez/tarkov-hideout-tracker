"use client";

import { Compass, History, PanelTopClose, PanelTopOpen, Search, SlidersHorizontal, Upload, X } from "lucide-react";
import { useState } from "react";
import type { FullQuest } from "@/types";
import { useUIStore } from "@/lib/stores/useUIStore";
import { cn } from "@/lib/utils";
import { QuestSyncDialog } from "../components/QuestSyncDialog";
import { QuestLogImportDialog } from "../components/QuestLogImportDialog";
import { ENABLE_MANUAL_QUEST_SYNC } from "../quest-feature-flags";
import { useQuestWorkspace } from "./QuestWorkspaceContext";

export function QuestActionBar({ quests }: { quests: FullQuest[] }) {
    const { searchQuery, setSearchQuery, mode, setMode, listMode, setListMode } = useQuestWorkspace();
    const isMainNavHidden = useUIStore((state) => state.isMainNavHidden);
    const setMainNavHidden = useUIStore((state) => state.setMainNavHidden);
    const [searchOpen, setSearchOpen] = useState(false);
    const [syncOpen, setSyncOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    return (
        <>
            <div className="flex min-h-14 items-center gap-2 bg-[#101113] px-3 sm:px-4">
                <button
                    type="button"
                    aria-pressed={isMainNavHidden}
                    onClick={() => setMainNavHidden(!isMainNavHidden)}
                    className="inline-flex items-center gap-2 border border-white/8 bg-white/3 px-3 py-2 text-xs text-gray-400 transition-colors hover:border-white/20 hover:text-white"
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
                            ? "border-tarkov-green/40 bg-tarkov-green/10 text-tarkov-green"
                            : "border-white/8 bg-white/3 text-gray-400 hover:border-white/20 hover:text-white",
                    )}
                >
                    <History size={14} /> <span className="hidden sm:inline">History</span>
                </button>
                {searchOpen ? (
                    <div className="flex min-w-0 flex-1 items-center gap-2 border-b border-tarkov-green/50 px-1 py-1.5">
                        <Search size={15} className="text-gray-500" />
                        <input autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search quests, traders, objectives…" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-700" />
                        <button type="button" aria-label="Close search" onClick={() => { setSearchOpen(false); setSearchQuery(""); }} className="text-gray-600 hover:text-white"><X size={14} /></button>
                    </div>
                ) : (
                    <button type="button" onClick={() => setSearchOpen(true)} className="inline-flex items-center gap-2 border border-white/8 bg-white/3 px-3 py-2 text-xs text-gray-400 transition-colors hover:border-white/20 hover:text-white"><Search size={14} /> Search</button>
                )}
                {!searchOpen && <div className="flex-1" />}
                {ENABLE_MANUAL_QUEST_SYNC && (
                    <button type="button" onClick={() => setSyncOpen(true)} className="hidden items-center gap-2 border border-white/8 bg-white/3 px-3 py-2 text-xs text-gray-400 transition-colors hover:border-white/20 hover:text-white sm:inline-flex"><SlidersHorizontal size={14} /> Sync</button>
                )}
                <button type="button" onClick={() => setImportOpen(true)} className="inline-flex items-center gap-2 border border-white/8 bg-white/3 px-3 py-2 text-xs text-gray-400 transition-colors hover:border-white/20 hover:text-white"><Upload size={14} /> <span className="hidden sm:inline">Upload</span></button>
                <button type="button" aria-pressed={mode === "planner"} onClick={() => setMode(mode === "planner" ? "details" : "planner")} className={cn("inline-flex items-center gap-2 border px-3 py-2 text-xs font-semibold transition-colors", mode === "planner" ? "border-tarkov-green/50 bg-tarkov-green/12 text-tarkov-green" : "border-white/8 bg-white/3 text-gray-300 hover:border-tarkov-green/35 hover:text-tarkov-green")}><Compass size={15} /> Raid planner</button>
            </div>
            {ENABLE_MANUAL_QUEST_SYNC && (
                <QuestSyncDialog open={syncOpen} onOpenChange={setSyncOpen} />
            )}
            <QuestLogImportDialog open={importOpen} onOpenChange={setImportOpen} quests={quests} />
        </>
    );
}
