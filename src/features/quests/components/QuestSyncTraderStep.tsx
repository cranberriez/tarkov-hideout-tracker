"use client";

import { useState } from "react";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useQuestsContext } from "../QuestsContext";
import { QuestSyncSelectableQuestRow } from "./QuestSyncSelectableQuestRow";

const LOYALTY_LEVELS = [1, 2, 3, 4] as const;
const NETWORK_PROVIDER_PART_1_ID = "625d6ff5ddc94657c21a1625";

export function QuestSyncTraderStep({
    activeTraderId,
    onBack,
    onSelectTrader,
    selectedQuestIdsByTrader,
    onToggleQuest,
    latestResultByTrader,
    onSyncResult,
    onClose,
}: {
    activeTraderId: string | null;
    onBack: () => void;
    onSelectTrader: (traderId: string) => void;
    selectedQuestIdsByTrader: Record<string, string[]>;
    onToggleQuest: (traderId: string, questId: string) => void;
    latestResultByTrader: Record<string, string[]>;
    onSyncResult: (traderId: string, completedIds: string[]) => void;
    onClose: () => void;
}) {
    const [searchQuery, setSearchQuery] = useState("");
    const {
        traders,
        questsById,
        lastQuestSyncAction,
        getVisibleSyncCandidatesForTrader,
        syncTraderSelection,
        applyTraderSyncReviewFilters,
    } = useQuestsContext();
    const { questTraderLoyaltyLevels, setQuestTraderLoyaltyLevel } = useUserStore();

    const activeTrader = traders.find((trader) => trader.id === activeTraderId) ?? null;
    const loyaltyLevel = activeTrader ? (questTraderLoyaltyLevels[activeTrader.id] ?? 1) : 1;
    const selectedQuestIds = activeTrader ? (selectedQuestIdsByTrader[activeTrader.id] ?? []) : [];
    const visibleCandidates = activeTrader ? getVisibleSyncCandidatesForTrader(activeTrader.id) : [];
    const normalizedSearch = searchQuery.trim().toLowerCase();

    const filteredCandidates = visibleCandidates.filter((quest) =>
        normalizedSearch ? quest.name.toLowerCase().includes(normalizedSearch) : true,
    );

    const showNetworkProviderWarning = selectedQuestIds.includes(NETWORK_PROVIDER_PART_1_ID);
    const syncedQuestNames = activeTrader
        ? (latestResultByTrader[activeTrader.id] ?? [])
              .map((questId) => questsById.get(questId)?.name)
              .filter((questName): questName is string => Boolean(questName))
        : [];

    return (
        <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
            <div className="space-y-2">
                <button
                    onClick={onBack}
                    className="text-xs font-semibold uppercase tracking-wide text-gray-500 transition-colors hover:text-white"
                >
                    Back
                </button>
                <div className="space-y-1">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-300">
                        Step 2 · Pick Trader
                    </h3>
                    <p className="text-xs text-gray-500">Select visible quests, then sync.</p>
                </div>
                <div className="space-y-1">
                    {traders.map((trader) => (
                        <button
                            key={trader.id}
                            onClick={() => onSelectTrader(trader.id)}
                            className={`flex w-full items-center justify-between rounded-sm border px-3 py-2 text-left text-sm transition-colors ${
                                trader.id === activeTraderId
                                    ? "border-tarkov-green/40 bg-tarkov-green/10 text-white"
                                    : "border-white/10 bg-black/20 text-gray-400 hover:border-white/20 hover:text-white"
                            }`}
                        >
                            <span>{trader.name}</span>
                            {latestResultByTrader[trader.id] && (
                                <span className="text-[10px] uppercase tracking-wide text-tarkov-green">
                                    Synced
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            <div className="min-w-0 rounded-sm border border-white/10 bg-black/20 p-4">
                {!activeTrader ? (
                    <div className="flex min-h-64 items-center justify-center text-sm text-gray-500">
                        Select a trader.
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex flex-col gap-3 border-b border-white/10 pb-4 md:flex-row md:items-center md:justify-between">
                            <div className="space-y-1">
                                <h4 className="text-lg font-semibold text-white">{activeTrader.name}</h4>
                                <p className="text-xs text-gray-500">
                                    Set trader level, select visible quests, then sync.
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                    LL
                                </span>
                                <div className="flex gap-1.5">
                                    {LOYALTY_LEVELS.map((level) => (
                                        <button
                                            key={level}
                                            onClick={() => setQuestTraderLoyaltyLevel(activeTrader.id, level)}
                                            className={`rounded-sm px-3 py-2 text-sm transition-colors ${
                                                loyaltyLevel === level
                                                    ? "bg-tarkov-green text-black"
                                                    : "border border-white/10 bg-black/30 text-gray-400 hover:border-white/20 hover:text-white"
                                            }`}
                                        >
                                            LL{level}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <input
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder="Search visible quests"
                                className="w-full rounded-sm border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-gray-600 focus:border-tarkov-green/50"
                            />
                            <div className="text-xs text-gray-500">
                                {visibleCandidates.length} visible quest{visibleCandidates.length === 1 ? "" : "s"}
                            </div>
                            {showNetworkProviderWarning && (
                                <div className="rounded-sm border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-xs text-amber-200">
                                    If acquired via story quests, do not sync progress, story skips
                                    a lot of pre-requisite quests.
                                </div>
                            )}
                            <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
                                {filteredCandidates.map((quest) => (
                                    <QuestSyncSelectableQuestRow
                                        key={quest.id}
                                        quest={quest}
                                        checked={selectedQuestIds.includes(quest.id)}
                                        onToggle={() => onToggleQuest(activeTrader.id, quest.id)}
                                    />
                                ))}
                                {filteredCandidates.length === 0 && (
                                    <div className="rounded-sm border border-dashed border-white/10 px-3 py-6 text-center text-sm text-gray-500">
                                        No visible quests match the current search.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
                            <button
                                onClick={() => {
                                    const result = syncTraderSelection(activeTrader.id, selectedQuestIds);
                                    onSyncResult(activeTrader.id, result.completedIds);
                                }}
                                disabled={selectedQuestIds.length === 0}
                                className={`rounded-sm px-4 py-2 text-sm font-semibold transition-colors ${
                                    selectedQuestIds.length > 0
                                        ? "bg-tarkov-green text-black hover:bg-tarkov-green-dim"
                                        : "cursor-not-allowed border border-white/10 bg-black/30 text-gray-600"
                                }`}
                            >
                                Sync {activeTrader.name}
                            </button>
                            <span className="text-xs text-gray-500">{selectedQuestIds.length} selected</span>
                        </div>

                        {lastQuestSyncAction?.traderId === activeTrader.id && (
                            <div className="space-y-3 rounded-sm border border-white/10 bg-black/30 p-4">
                                <div className="space-y-1">
                                    <h5 className="text-sm font-semibold text-white">Sync Result</h5>
                                    <p className="text-xs text-gray-500">
                                        {lastQuestSyncAction.completedIds.length > 0
                                            ? `Completed ${lastQuestSyncAction.completedIds.length} quest${lastQuestSyncAction.completedIds.length === 1 ? "" : "s"}.`
                                            : "No additional quests were completed."}
                                    </p>
                                </div>

                                {lastQuestSyncAction.prerequisiteCompletedIds.length > 0 && (
                                    <div className="space-y-1">
                                        <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                            Prerequisites
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {lastQuestSyncAction.prerequisiteCompletedIds.map((questId) => (
                                                <span
                                                    key={questId}
                                                    className="rounded-sm border border-white/10 bg-black/40 px-2 py-1 text-xs text-gray-300"
                                                >
                                                    {questsById.get(questId)?.name ?? questId}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {lastQuestSyncAction.autoCompletedIds.length > 0 && (
                                    <div className="space-y-1">
                                        <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                            Follow-Ups
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {lastQuestSyncAction.autoCompletedIds.map((questId) => (
                                                <span
                                                    key={questId}
                                                    className="rounded-sm border border-white/10 bg-black/40 px-2 py-1 text-xs text-gray-300"
                                                >
                                                    {questsById.get(questId)?.name ?? questId}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="rounded-sm border border-sky-500/20 bg-sky-500/8 p-3 text-sm text-sky-100">
                                    Review the quest list, then come back if needed.
                                    <div className="mt-3">
                                        <button
                                            onClick={() => {
                                                applyTraderSyncReviewFilters(activeTrader.id);
                                                onClose();
                                            }}
                                            className="rounded-sm border border-sky-400/30 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-sky-200 transition-colors hover:border-sky-300/50 hover:text-white"
                                        >
                                            Close And Show {activeTrader.name}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {syncedQuestNames.length > 0 && lastQuestSyncAction?.traderId !== activeTrader.id && (
                            <div className="rounded-sm border border-white/10 bg-black/25 p-3 text-xs text-gray-500">
                                Last local result for {activeTrader.name}: {syncedQuestNames.join(", ")}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
