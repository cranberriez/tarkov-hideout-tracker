"use client";

import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUserStore } from "@/lib/stores/useUserStore";
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
    const { quests, lastQuestSyncAction, undoLastQuestSync } = useQuestsContext();
    const completedQuests = useUserStore((state) => state.completedQuests);
    const [step, setStep] = useState<SyncStep>("profile");
    const [selectedQuestIdsByTrader, setSelectedQuestIdsByTrader] = useState<Record<string, string[]>>({});
    const [latestResultByTrader, setLatestResultByTrader] = useState<Record<string, string[]>>({});
    const [latestNoOpByTrader, setLatestNoOpByTrader] = useState<Record<string, boolean>>({});
    const [completedSnapshotByTrader, setCompletedSnapshotByTrader] = useState<
        Record<string, Record<string, boolean>>
    >({});
    const [selectedTraderId, setSelectedTraderId] = useState<string | null>(null);
    const questTraderIds = useMemo(
        () => new Map(quests.map((quest) => [quest.id, quest.trader.id])),
        [quests],
    );
    const currentLatestResultByTrader = useMemo(
        () =>
            filterCurrentTraderSyncState(
                latestResultByTrader,
                completedSnapshotByTrader,
                completedQuests,
                questTraderIds,
            ),
        [completedQuests, completedSnapshotByTrader, latestResultByTrader, questTraderIds],
    );
    const currentLatestNoOpByTrader = useMemo(
        () =>
            filterCurrentTraderSyncState(
                latestNoOpByTrader,
                completedSnapshotByTrader,
                completedQuests,
                questTraderIds,
            ),
        [completedQuests, completedSnapshotByTrader, latestNoOpByTrader, questTraderIds],
    );

    const handleOpenChange = (nextOpen: boolean) => {
        onOpenChange(nextOpen);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden border-border-color bg-card p-0 md:max-w-5xl">
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
                                    setLatestNoOpByTrader((current) => {
                                        const next = { ...current };
                                        delete next[lastQuestSyncAction.traderId];
                                        return next;
                                    });
                                    setCompletedSnapshotByTrader((current) => {
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

                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
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
                            onToggleQuest={(traderId, questId) => {
                                setSelectedQuestIdsByTrader((current) => {
                                    const existing = current[traderId] ?? [];
                                    const nextIds = existing.includes(questId)
                                        ? existing.filter((id) => id !== questId)
                                        : [...existing, questId];
                                    return { ...current, [traderId]: nextIds };
                                });
                                setLatestResultByTrader((current) =>
                                    omitTraderIds(current, new Set([traderId])),
                                );
                                setLatestNoOpByTrader((current) =>
                                    omitTraderIds(current, new Set([traderId])),
                                );
                                setCompletedSnapshotByTrader((current) =>
                                    omitTraderIds(current, new Set([traderId])),
                                );
                            }}
                            latestResultByTrader={currentLatestResultByTrader}
                            latestNoOpByTrader={currentLatestNoOpByTrader}
                            onSyncResult={(traderId, completedIds) => {
                                if (completedIds.length > 0) {
                                    setLatestResultByTrader((current) => ({
                                        ...current,
                                        [traderId]: completedIds,
                                    }));
                                    setLatestNoOpByTrader((current) => ({
                                        ...current,
                                        [traderId]: false,
                                    }));
                                    setCompletedSnapshotByTrader((current) => ({
                                        ...current,
                                        [traderId]: buildCompletedQuestSnapshot(
                                            completedQuests,
                                            completedIds,
                                        ),
                                    }));
                                    return;
                                }

                                setLatestNoOpByTrader((current) => ({
                                    ...current,
                                    [traderId]: true,
                                }));
                                setCompletedSnapshotByTrader((current) => ({
                                    ...current,
                                    [traderId]: buildCompletedQuestSnapshot(completedQuests),
                                }));
                            }}
                            onClose={() => handleOpenChange(false)}
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

function omitTraderIds<T>(record: Record<string, T>, traderIds: ReadonlySet<string>) {
    let changed = false;
    const next = { ...record };

    for (const traderId of traderIds) {
        if (traderId in next) {
            delete next[traderId];
            changed = true;
        }
    }

    return changed ? next : record;
}

function buildCompletedQuestSnapshot(
    completedQuests: Record<string, boolean>,
    newlyCompletedQuestIds: string[] = [],
) {
    const snapshot = { ...completedQuests };
    for (const questId of newlyCompletedQuestIds) {
        snapshot[questId] = true;
    }
    return snapshot;
}

function filterCurrentTraderSyncState<T>(
    record: Record<string, T>,
    snapshots: Record<string, Record<string, boolean>>,
    completedQuests: Record<string, boolean>,
    questTraderIds: ReadonlyMap<string, string>,
) {
    const staleTraderIds = getStaleSyncedTraderIds(record, snapshots, completedQuests, questTraderIds);
    return staleTraderIds.size > 0 ? omitTraderIds(record, staleTraderIds) : record;
}

function getStaleSyncedTraderIds<T>(
    record: Record<string, T>,
    snapshots: Record<string, Record<string, boolean>>,
    completedQuests: Record<string, boolean>,
    questTraderIds: ReadonlyMap<string, string>,
) {
    const trackedTraderIds = new Set(Object.keys(record));
    const staleTraderIds = new Set<string>();

    if (trackedTraderIds.size === 0) {
        return staleTraderIds;
    }

    for (const [questId, isCompleted] of Object.entries(completedQuests)) {
        if (!isCompleted) {
            continue;
        }

        const traderId = questTraderIds.get(questId);
        if (!traderId || !trackedTraderIds.has(traderId)) {
            continue;
        }

        if (!snapshots[traderId]?.[questId]) {
            staleTraderIds.add(traderId);
        }
    }

    return staleTraderIds;
}
