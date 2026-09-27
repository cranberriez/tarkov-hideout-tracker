"use client";

import { X } from "lucide-react";
import type { FullQuest } from "@/types/quests";

export function QuestDebugPanel({ quest, onClose }: { quest: FullQuest; onClose: () => void }) {
    return (
        <aside className="fixed bottom-16 right-5 z-50 flex max-h-[70vh] w-[min(680px,calc(100vw-2.5rem))] flex-col overflow-hidden border border-highlight/15 bg-[var(--card-bg)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-highlight/10 px-4 py-3">
                <div><p className="text-xs font-semibold text-foreground">Quest debug data</p><p className="mt-0.5 text-[10px] text-subtle-foreground">Normalized data received by this page</p></div>
                <button type="button" onClick={onClose} aria-label="Close quest debug data" className="text-subtle-foreground hover:text-foreground"><X size={15} /></button>
            </div>
            <div className="min-h-0 overflow-y-auto p-4">
                <DebugJson label="Objectives" value={quest.objectives} />
                <DebugJson label="Full quest" value={quest} />
            </div>
        </aside>
    );
}

function DebugJson({ label, value }: { label: string; value: unknown }) {
    return (
        <details className="mb-3 border border-highlight/8 bg-shadow/25" open={label === "Objectives"}>
            <summary className="cursor-pointer px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</summary>
            <pre className="max-h-80 overflow-auto border-t border-highlight/8 p-3 text-[10px] leading-relaxed text-subtle-foreground">{JSON.stringify(value, null, 2)}</pre>
        </details>
    );
}
