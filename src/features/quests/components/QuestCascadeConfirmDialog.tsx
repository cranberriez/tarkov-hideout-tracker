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
    const autoFailedCount = request.autoFailedQuestIds?.length ?? 0;
    const hasAutoFailures = isComplete && autoFailedCount > 0;
    const autoFailedQuestIdSet = new Set(request.autoFailedQuestIds ?? []);
    const questIdsToComplete = hasAutoFailures
        ? request.questIds.filter((questId) => !autoFailedQuestIdSet.has(questId))
        : request.questIds;

    const highlightQuestIds = new Set<string>([
        ...request.crossTraderQuestIds,
        ...request.sensitiveQuestIds,
        ...(request.autoFailedQuestIds ?? []),
    ]);

    const handleConfirm = () => {
        if (isComplete) {
            applyQuestCompletionChange({
                complete: request.questIds,
                fail: request.autoFailedQuestIds ?? [],
            });
        } else {
            applyQuestCompletionChange({ uncomplete: request.questIds });
        }
        closeRequest();
    };

    const handleCompleteSelectedOnly = () => {
        applyQuestCompletionChange({
            complete: [request.rootQuestId],
            fail: request.rootAutoFailedQuestIds ?? [],
        });
        closeRequest();
    };

    return (
        <Dialog
            open={true}
            onOpenChange={(open) => {
                if (!open) closeRequest();
            }}
        >
            <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden border-border-color bg-card p-0 md:max-w-2xl">
                <DialogHeader className="border-b border-border-color bg-shadow/60 px-6 py-4">
                    <DialogTitle className="text-sm font-semibold tracking-[0.2em] text-foreground">
                        {hasAutoFailures
                            ? "Confirm branch change"
                            : isComplete
                              ? `Mark ${totalCount} quest${totalCount === 1 ? "" : "s"} as complete`
                              : `Uncomplete ${totalCount} quest${totalCount === 1 ? "" : "s"}`}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground">
                        {hasAutoFailures
                            ? `This will complete the selected quest and fail ${autoFailedCount} mutually exclusive quest${autoFailedCount === 1 ? "" : "s"}.`
                            : isComplete
                              ? "Completing this quest will also complete the prerequisite chain below."
                              : "Uncompleting this quest will also uncomplete the quests that depend on it."}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-3 px-6 py-4">
                    {!hasAutoFailures && crossTraderCount > 0 && (
                        <div className="rounded-sm border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                            Includes {crossTraderCount} quest{crossTraderCount === 1 ? "" : "s"}{" "}
                            from other traders.
                        </div>
                    )}
                    {!hasAutoFailures && sensitiveCount > 0 && (
                        <div className="rounded-sm border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
                            Includes sensitive backfill:{" "}
                            {request.sensitiveQuestIds
                                .map(
                                    (id) =>
                                        questsById.get(id)?.name ??
                                        getSensitiveBackfillQuest(id)?.name ??
                                        id,
                                )
                                .join(", ")}
                            . Confirm only if you have actually done these.
                        </div>
                    )}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
                    <div className="space-y-4">
                        {hasAutoFailures && (
                            <section className="space-y-2">
                                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-danger">
                                    Will be failed
                                </div>
                                <QuestListByTrader
                                    questIds={request.autoFailedQuestIds ?? []}
                                    questsById={questsById}
                                    highlightQuestIds={highlightQuestIds}
                                />
                            </section>
                        )}
                        {(!hasAutoFailures || questIdsToComplete.length > 0) && (
                            <section className="space-y-2">
                                {hasAutoFailures && (
                                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-success">
                                        Will be completed
                                    </div>
                                )}
                                <QuestListByTrader
                                    questIds={questIdsToComplete}
                                    questsById={questsById}
                                    highlightQuestIds={highlightQuestIds}
                                />
                            </section>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap justify-end gap-2 border-t border-border-color bg-shadow/40 px-6 py-3">
                    <button
                        type="button"
                        onClick={closeRequest}
                        className="rounded-sm border border-highlight/10 bg-highlight/5 px-3 py-2 text-sm text-foreground transition-colors hover:border-highlight/20 hover:bg-highlight/10 hover:text-foreground"
                    >
                        Cancel
                    </button>
                    {isComplete && request.questIds.some((questId) => questId !== request.rootQuestId) && (
                        <button
                            type="button"
                            onClick={handleCompleteSelectedOnly}
                            className="rounded-sm border border-brand/30 bg-brand/10 px-3 py-2 text-sm font-semibold text-brand transition-colors hover:border-brand/60"
                        >
                            Complete Only Selected
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleConfirm}
                        className="rounded-sm border border-warning/30 bg-warning/10 px-3 py-2 text-sm font-semibold text-warning transition-colors hover:border-warning/60 hover:bg-warning/15"
                    >
                        Confirm
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
