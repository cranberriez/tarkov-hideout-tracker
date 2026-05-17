"use client";

import { useUserStore } from "@/lib/stores/useUserStore";
import { useUIStore } from "@/lib/stores/useUIStore";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { getSensitiveBackfillQuest } from "@/lib/utils/sensitive-quest-backfill";
import { QuestListByTrader } from "./QuestListByTrader";
import { useQuestsContext } from "../QuestsContext";

export function QuestCascadeConfirmDialog() {
    const request = useUIStore((state) => state.questCascadeRequest);
    const closeRequest = useUIStore((state) => state.closeQuestCascadeRequest);
    const applyQuestCompletionChange = useUserStore((state) => state.applyQuestCompletionChange);
    const { questsById } = useQuestsContext();

    if (!request) return null;

    const isComplete = request.mode === "complete";
    const totalCount = request.questIds.length;
    const crossTraderCount = request.crossTraderQuestIds.length;
    const sensitiveCount = request.sensitiveQuestIds.length;

    const highlightQuestIds = new Set<string>([
        ...request.crossTraderQuestIds,
        ...request.sensitiveQuestIds,
    ]);

    const handleConfirm = () => {
        if (isComplete) {
            applyQuestCompletionChange({ complete: request.questIds });
        } else {
            applyQuestCompletionChange({ uncomplete: request.questIds });
        }
        closeRequest();
    };

    return (
        <Dialog open={true} onOpenChange={(open) => { if (!open) closeRequest(); }}>
            <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden border-border-color bg-card p-0 md:max-w-2xl">
                <DialogHeader className="border-b border-border-color bg-black/60 px-6 py-4">
                    <DialogTitle className="text-sm font-semibold tracking-[0.2em] text-gray-300">
                        {isComplete
                            ? `Mark ${totalCount} quest${totalCount === 1 ? "" : "s"} as complete`
                            : `Uncomplete ${totalCount} quest${totalCount === 1 ? "" : "s"}`}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-gray-400">
                        {isComplete
                            ? "Completing this quest will also complete the prerequisite chain below."
                            : "Uncompleting this quest will also uncomplete the quests that depend on it."}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-3 px-6 py-4">
                    {crossTraderCount > 0 && (
                        <div className="rounded-sm border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                            Includes {crossTraderCount} quest{crossTraderCount === 1 ? "" : "s"} from other traders.
                        </div>
                    )}
                    {sensitiveCount > 0 && (
                        <div className="rounded-sm border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-100">
                            Includes sensitive backfill:{" "}
                            {request.sensitiveQuestIds
                                .map((id) => questsById.get(id)?.name ?? getSensitiveBackfillQuest(id)?.name ?? id)
                                .join(", ")}
                            . Confirm only if you have actually done these.
                        </div>
                    )}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
                    <QuestListByTrader
                        questIds={request.questIds}
                        questsById={questsById}
                        highlightQuestIds={highlightQuestIds}
                    />
                </div>

                <div className="flex justify-end gap-2 border-t border-border-color bg-black/40 px-6 py-3">
                    <button
                        type="button"
                        onClick={closeRequest}
                        className="rounded-sm border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-300 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        className="rounded-sm border border-tarkov-green/30 bg-tarkov-green/10 px-3 py-2 text-sm font-semibold text-tarkov-green transition-colors hover:border-tarkov-green/60"
                    >
                        Confirm
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
