"use client";

import type { FullQuest } from "@/types";
import { Upload } from "lucide-react";
import { useState } from "react";
import { QuestSyncDialog } from "./QuestSyncDialog";
import { QuestLogImportDialog } from "./QuestLogImportDialog";

interface QuestsSyncBarProps {
    quests: FullQuest[];
}

export function QuestsSyncBar({ quests }: QuestsSyncBarProps) {
    const [syncOpen, setSyncOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);

    return (
        <>
            <div className="flex flex-col gap-3 rounded-md border border-white/10 bg-black/20 p-3">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-600">
                    Sync Quests
                </label>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => setSyncOpen(true)}
                        className="rounded-sm border border-tarkov-green/30 bg-tarkov-green/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-tarkov-green transition-colors hover:border-tarkov-green/60"
                    >
                        Manual Sync
                    </button>
                    <button
                        onClick={() => setImportOpen(true)}
                        className="inline-flex items-center gap-2 rounded-sm border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-300 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
                    >
                        <Upload size={16} />
                        Upload Logs
                    </button>
                </div>
            </div>

            <QuestSyncDialog open={syncOpen} onOpenChange={setSyncOpen} />
            <QuestLogImportDialog open={importOpen} onOpenChange={setImportOpen} quests={quests} />
        </>
    );
}
