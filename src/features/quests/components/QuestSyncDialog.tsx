"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuestsContext } from "../QuestsContext";
import { QuestSyncProfileStep } from "./QuestSyncProfileStep";
import { QuestSyncTraderStep } from "./QuestSyncTraderStep";

type SyncStep = "profile" | "traders";

export function QuestSyncDialog({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const { lastQuestSyncAction, undoLastQuestSync } = useQuestsContext();
    const [step, setStep] = useState<SyncStep>("profile");
    const [selectedQuestIdsByTrader, setSelectedQuestIdsByTrader] = useState<Record<string, string[]>>({});
    const [latestResultByTrader, setLatestResultByTrader] = useState<Record<string, string[]>>({});
    const [selectedTraderId, setSelectedTraderId] = useState<string | null>(null);

    const handleOpenChange = (nextOpen: boolean) => {
        if (!nextOpen) {
            setStep("profile");
            setSelectedQuestIdsByTrader({});
            setLatestResultByTrader({});
            setSelectedTraderId(null);
        }
        onOpenChange(nextOpen);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-hidden border-border-color bg-card p-0 md:max-w-5xl">
                <DialogHeader className="border-b border-border-color bg-black/60 px-6 py-4">
                    <DialogTitle className="text-sm font-semibold tracking-[0.2em] text-gray-400">
                        QUEST SYNC
                    </DialogTitle>
                </DialogHeader>

                {lastQuestSyncAction && (
                    <div className="border-b border-white/10 bg-black/50 px-6 py-3">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="text-sm text-gray-300">
                                Last sync: {lastQuestSyncAction.traderName} ·{" "}
                                {lastQuestSyncAction.completedIds.length} quest
                                {lastQuestSyncAction.completedIds.length === 1 ? "" : "s"} completed
                            </div>
                            <button
                                onClick={() => {
                                    if (!undoLastQuestSync()) return;
                                    setLatestResultByTrader((current) => {
                                        const next = { ...current };
                                        delete next[lastQuestSyncAction.traderId];
                                        return next;
                                    });
                                }}
                                disabled={lastQuestSyncAction.completedIds.length === 0}
                                className={`rounded-sm px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
                                    lastQuestSyncAction.completedIds.length > 0
                                        ? "border border-white/10 bg-black/30 text-gray-200 hover:border-white/20 hover:text-white"
                                        : "cursor-not-allowed border border-white/10 bg-black/20 text-gray-600"
                                }`}
                            >
                                Undo Last Sync
                            </button>
                        </div>
                    </div>
                )}

                <div className="overflow-y-auto px-6 py-5">
                    {step === "profile" ? (
                        <QuestSyncProfileStep
                            onContinue={() => setStep("traders")}
                        />
                    ) : (
                        <QuestSyncTraderStep
                            activeTraderId={selectedTraderId}
                            onBack={() => setStep("profile")}
                            onSelectTrader={setSelectedTraderId}
                            selectedQuestIdsByTrader={selectedQuestIdsByTrader}
                            onToggleQuest={(traderId, questId) =>
                                setSelectedQuestIdsByTrader((current) => {
                                    const existing = current[traderId] ?? [];
                                    const nextIds = existing.includes(questId)
                                        ? existing.filter((id) => id !== questId)
                                        : [...existing, questId];
                                    return { ...current, [traderId]: nextIds };
                                })
                            }
                            latestResultByTrader={latestResultByTrader}
                            onSyncResult={(traderId, completedIds) =>
                                setLatestResultByTrader((current) => ({
                                    ...current,
                                    [traderId]: completedIds,
                                }))
                            }
                            onClose={() => handleOpenChange(false)}
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
