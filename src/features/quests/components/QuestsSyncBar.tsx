"use client";

import type { FullQuest } from "@/types/quests";
import { Upload } from "lucide-react";
import { useState } from "react";
import { QuestSyncDialog } from "./QuestSyncDialog";
import { QuestLogImportDialog } from "./QuestLogImportDialog";
import { ENABLE_MANUAL_QUEST_SYNC } from "../quest-feature-flags";

interface QuestsSyncBarProps {
    quests: FullQuest[];
}

export function QuestsSyncBar({ quests }: QuestsSyncBarProps) {
    const [syncOpen, setSyncOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);

    return (
        <>
            <div className="flex flex-col gap-3 rounded-md border border-highlight/10 bg-shadow/20 p-3">
                <label className="text-[10px] font-bold uppercase tracking-wider text-subtle-foreground">
                    Sync Quests
                </label>
                <div className="flex flex-wrap items-center gap-2">
                    {ENABLE_MANUAL_QUEST_SYNC && (
                        <button
                            onClick={() => setSyncOpen(true)}
                            className="rounded-sm border border-brand/30 bg-brand/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-brand transition-colors hover:border-brand/60"
                        >
                            Manual Sync
                        </button>
                    )}
                    <button
                        onClick={() => setImportOpen(true)}
                        className="inline-flex items-center gap-2 rounded-sm border border-highlight/10 bg-highlight/5 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-foreground transition-colors hover:border-highlight/20 hover:bg-highlight/10 hover:text-foreground"
                    >
                        <Upload size={16} />
                        Upload Logs
                    </button>
                </div>
            </div>

            {ENABLE_MANUAL_QUEST_SYNC && (
                <QuestSyncDialog open={syncOpen} onOpenChange={setSyncOpen} />
            )}
            <QuestLogImportDialog open={importOpen} onOpenChange={setImportOpen} quests={quests} />
        </>
    );
}
