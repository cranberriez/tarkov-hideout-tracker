import { useUserStore } from "@/lib/stores/useUserStore";
import { cn } from "@/lib/utils";
import { QuestListItem } from "./QuestListItem";
import { useQuestWorkspace } from "./QuestWorkspaceContext";

export function QuestHistoryList() {
    const history = useUserStore((state) => state.questChangeHistory);
    const { questsById, selectedQuestId, setSelectedQuestId, setMode } = useQuestWorkspace();
    const entries = [...history].reverse().filter((entry) => questsById.has(entry.questId));
    return (
        <div className="min-h-0 flex-1 overflow-y-auto scroll-smooth bg-[#0b0c0e]">
            <div className="flex h-8 items-center justify-between border-b border-white/8 px-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-gray-600"><span>Quest history</span><span>{entries.length} changes</span></div>
            {entries.map((entry, index) => (
                <div key={`${entry.timestamp}-${entry.questId}-${index}`} className="border-b border-white/10">
                    <div className={cn("flex items-center justify-between border-b px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em]", entry.change === "completed" ? "border-tarkov-green/15 bg-tarkov-green/7 text-tarkov-green/80" : "border-amber-300/15 bg-amber-300/7 text-amber-200/80")}>
                        <span>{entry.change === "completed" ? "Marked completed" : "Marked incomplete"}</span>
                        <time dateTime={new Date(entry.timestamp).toISOString()} title={new Date(entry.timestamp).toLocaleString()}>{formatHistoryTime(entry.timestamp)}</time>
                    </div>
                    <QuestListItem questId={entry.questId} selected={selectedQuestId === entry.questId} highlighted={false} onSelect={() => { setSelectedQuestId(entry.questId); setMode("details"); }} includeElementId={false} />
                </div>
            ))}
            {entries.length === 0 && <div className="border-b border-dashed border-white/10 px-5 py-14 text-center text-sm text-gray-600">Quest completion changes will appear here.</div>}
        </div>
    );
}

export function formatHistoryTime(timestamp: number, today = new Date()) {
    const date = new Date(timestamp);
    return date.toDateString() === today.toDateString()
        ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
        : date.toLocaleDateString([], { month: "short", day: "numeric" });
}
