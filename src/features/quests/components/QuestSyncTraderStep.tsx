"use client";

import { useMemo, useState } from "react";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useQuestsContext } from "../QuestsContext";
import { QuestSyncSelectableQuestRow } from "./QuestSyncSelectableQuestRow";
import {
    NETWORK_PROVIDER_PART_1_ID,
    allowSensitiveBackfillQuest,
    createEmptySensitiveBackfillDecisions,
    denySensitiveBackfillQuest,
    getSensitiveBackfillQuest,
    getSensitiveBackfillQuestName,
} from "@/lib/utils/sensitive-quest-backfill";

const LOYALTY_LEVELS = [1, 2, 3, 4] as const;

export function QuestSyncTraderStep({
    activeTraderId,
    onBack,
    onSelectTrader,
    selectedQuestIdsByTrader,
    onToggleQuest,
    latestResultByTrader,
    latestNoOpByTrader,
    onSyncResult,
    onClose,
}: {
    activeTraderId: string | null;
    onBack: () => void;
    onSelectTrader: (traderId: string) => void;
    selectedQuestIdsByTrader: Record<string, string[]>;
    onToggleQuest: (traderId: string, questId: string) => void;
    latestResultByTrader: Record<string, string[]>;
    latestNoOpByTrader: Record<string, boolean>;
    onSyncResult: (traderId: string, completedIds: string[]) => void;
    onClose: () => void;
}) {
    const [searchQuery, setSearchQuery] = useState("");
    const [inferOtherTraderChains, setInferOtherTraderChains] = useState(true);
    const [sensitiveBackfillDecisions, setSensitiveBackfillDecisions] = useState(
        createEmptySensitiveBackfillDecisions,
    );
    const {
        traders,
        questsById,
        faction,
        viewMode,
        setViewMode,
        lastQuestSyncAction,
        getSyncCandidatesForTrader,
        previewTraderSelection,
        syncTraderSelection,
    } = useQuestsContext();
    const { completedQuests, questTraderLoyaltyLevels, setQuestTraderLoyaltyLevel } =
        useUserStore();

    const activeTrader = traders.find((trader) => trader.id === activeTraderId) ?? null;
    const loyaltyLevel = activeTrader ? (questTraderLoyaltyLevels[activeTrader.id] ?? 1) : 1;
    const selectedQuestIds = useMemo(
        () => (activeTraderId ? (selectedQuestIdsByTrader[activeTraderId] ?? []) : []),
        [activeTraderId, selectedQuestIdsByTrader],
    );
    const allowedSensitiveBackfillQuestIds = sensitiveBackfillDecisions.allowedQuestIds;
    const deniedSensitiveBackfillQuestIds = sensitiveBackfillDecisions.deniedQuestIds;
    const syncCandidates = activeTrader
        ? getSyncCandidatesForTrader(activeTrader.id).filter(
              (quest) =>
                  !completedQuests[quest.id] &&
                  (faction === null ||
                      (faction === "USEC"
                          ? quest.factionName !== "BEAR"
                          : quest.factionName !== "USEC")),
          )
        : [];
    const normalizedSearch = searchQuery.trim().toLowerCase();

    const filteredCandidates = syncCandidates
        .filter((quest) =>
            normalizedSearch ? quest.name.toLowerCase().includes(normalizedSearch) : true,
        )
        .sort((leftQuest, rightQuest) => {
            const leftSelected = selectedQuestIds.includes(leftQuest.id);
            const rightSelected = selectedQuestIds.includes(rightQuest.id);

            if (leftSelected === rightSelected) return 0;
            return leftSelected ? -1 : 1;
        });

    const showNetworkProviderWarning = selectedQuestIds.includes(NETWORK_PROVIDER_PART_1_ID);
    const syncedQuestNames = activeTrader
        ? (latestResultByTrader[activeTrader.id] ?? [])
              .map((questId) => questsById.get(questId)?.name)
              .filter((questName): questName is string => Boolean(questName))
        : [];
    const hasNoOpSyncResult = activeTrader ? (latestNoOpByTrader[activeTrader.id] ?? false) : false;
    const previewResult = (() => {
        if (!activeTrader || selectedQuestIds.length === 0) return null;
        return previewTraderSelection(
            activeTrader.id,
            selectedQuestIds,
            inferOtherTraderChains,
            allowedSensitiveBackfillQuestIds,
            deniedSensitiveBackfillQuestIds,
        );
    })();
    const blockedSensitiveQuestIds = previewResult?.blockedSensitiveQuestIds ?? [];

    const handleCloseAndJumpToTrader = () => {
        if (!activeTrader) return;
        if (viewMode !== "byTrader") setViewMode("byTrader");
        onClose();

        const targetId = `trader-${activeTrader.id}`;
        window.setTimeout(() => {
            const target = document.getElementById(targetId);
            if (target) {
                target.scrollIntoView({ behavior: "smooth", block: "start" });
                window.history.replaceState(null, "", `#${targetId}`);
                return;
            }

            window.location.hash = targetId;
        }, 50);
    };

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
                        Step 2 - Pick Trader
                    </h3>
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
                                <h4 className="text-lg font-semibold text-white">
                                    {activeTrader.name}
                                </h4>
                                <p className="text-xs text-gray-500">
                                    Search for and select ALL of the quests that are currently
                                    active.
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                    Loyalty Level
                                </span>
                                <div className="flex gap-1.5">
                                    {LOYALTY_LEVELS.map((level) => (
                                        <button
                                            key={level}
                                            onClick={() =>
                                                setQuestTraderLoyaltyLevel(activeTrader.id, level)
                                            }
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
                                placeholder="Search all quests"
                                className="w-full rounded-sm border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-gray-600 focus:border-tarkov-green/50"
                            />
                            <div className="text-xs text-gray-500">
                                {syncCandidates.length} total quest
                                {syncCandidates.length === 1 ? "" : "s"}
                            </div>
                            {showNetworkProviderWarning && (
                                <div className="rounded-sm border border-red-500/35 bg-red-500/12 px-3 py-2 text-xs font-semibold text-red-100">
                                    WARNING: If you got Network Provider - Part 1 from the story
                                    missions, do not select it. This can auto-complete a large
                                    number of quests you may not intend to do.
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
                                        No quests match the current search.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-3 border-t border-white/10 pt-4">
                            <label className="flex items-start gap-2 text-left">
                                <input
                                    type="checkbox"
                                    checked={inferOtherTraderChains}
                                    onChange={(event) =>
                                        setInferOtherTraderChains(event.target.checked)
                                    }
                                    className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/40 text-tarkov-green focus:ring-tarkov-green/40"
                                />
                                <span className="min-w-0">
                                    <span className="block text-xs font-semibold uppercase tracking-wide text-gray-300">
                                        Infer Other Completed Chains
                                    </span>
                                    <span className="mt-0.5 block text-xs text-gray-500">
                                        Enable this if you want any quest branch that can be
                                        completed to be marked as completed. Same-trader only.
                                    </span>
                                </span>
                            </label>

                            <div className="flex flex-wrap items-center gap-3">
                                <button
                                    onClick={() => {
                                        const result = syncTraderSelection(
                                            activeTrader.id,
                                            selectedQuestIds,
                                            inferOtherTraderChains,
                                            allowedSensitiveBackfillQuestIds,
                                            deniedSensitiveBackfillQuestIds,
                                        );
                                        setSensitiveBackfillDecisions(
                                            createEmptySensitiveBackfillDecisions(),
                                        );
                                        onSyncResult(activeTrader.id, result.completedIds);
                                    }}
                                    disabled={
                                        selectedQuestIds.length === 0 ||
                                        blockedSensitiveQuestIds.length > 0
                                    }
                                    className={`rounded-sm px-4 py-2 text-sm font-semibold transition-colors ${
                                        selectedQuestIds.length > 0 &&
                                        blockedSensitiveQuestIds.length === 0
                                            ? "bg-tarkov-green text-black hover:bg-tarkov-green-dim"
                                            : "cursor-not-allowed border border-white/10 bg-black/30 text-gray-600"
                                    }`}
                                >
                                    Sync {activeTrader.name}
                                </button>
                                <span className="text-xs text-gray-500">
                                    {selectedQuestIds.length} selected
                                </span>
                            </div>
                        </div>

                        {hasNoOpSyncResult && (
                            <div className="rounded-sm border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-xs text-amber-200">
                                This sync did not auto-complete any additional quests. The previous
                                sync result was kept so you can still undo it.
                            </div>
                        )}

                        {previewResult && (
                            <div className="space-y-3 rounded-sm border border-white/10 bg-black/30 p-4">
                                <div className="space-y-1">
                                    <h5 className="text-sm font-semibold text-white">
                                        Sync Preview
                                    </h5>
                                    <p className="text-xs text-gray-500">
                                        {previewResult.completedIds.length > 0
                                            ? `Will complete ${previewResult.completedIds.length} quest${previewResult.completedIds.length === 1 ? "" : "s"} if you sync now.`
                                            : "No quests would be completed with the current selection."}
                                    </p>
                                </div>

                                {previewResult.prerequisiteCompletedIds.length > 0 && (
                                    <div className="space-y-1">
                                        <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                            Prerequisites
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {previewResult.prerequisiteCompletedIds.map(
                                                (questId) => (
                                                    <span
                                                        key={questId}
                                                        className="rounded-sm border border-white/10 bg-black/40 px-2 py-1 text-xs text-gray-300"
                                                    >
                                                        {questsById.get(questId)?.name ?? questId}
                                                    </span>
                                                ),
                                            )}
                                        </div>
                                    </div>
                                )}

                                {blockedSensitiveQuestIds.length > 0 && (
                                    <SensitiveBackfillGate
                                        questIds={blockedSensitiveQuestIds}
                                        getQuestName={(questId) =>
                                            getSensitiveBackfillQuestName(questId, questsById)
                                        }
                                        onAllow={(questId) =>
                                            setSensitiveBackfillDecisions((current) =>
                                                allowSensitiveBackfillQuest(current, questId),
                                            )
                                        }
                                        onDeny={(questId) =>
                                            setSensitiveBackfillDecisions((current) =>
                                                denySensitiveBackfillQuest(current, questId),
                                            )
                                        }
                                    />
                                )}

                                {previewResult.inferredCompletedIds.length > 0 && (
                                    <div className="space-y-1">
                                        <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                            Inferred
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {previewResult.inferredCompletedIds.map((questId) => (
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
                            </div>
                        )}

                        {lastQuestSyncAction?.traderId === activeTrader.id &&
                            lastQuestSyncAction.completedIds.length > 0 && (
                                <div className="flex flex-wrap items-center gap-3 rounded-sm border border-sky-500/20 bg-sky-500/8 px-3 py-3 text-sm text-sky-100">
                                    <span>
                                        Last sync completed{" "}
                                        {lastQuestSyncAction.completedIds.length} quest
                                        {lastQuestSyncAction.completedIds.length === 1 ? "" : "s"}.
                                    </span>
                                    <button
                                        onClick={handleCloseAndJumpToTrader}
                                        className="rounded-sm border border-sky-400/30 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-sky-200 transition-colors hover:border-sky-300/50 hover:text-white"
                                    >
                                        Close And Jump To {activeTrader.name}
                                    </button>
                                </div>
                            )}

                        {syncedQuestNames.length > 0 &&
                            lastQuestSyncAction?.traderId !== activeTrader.id && (
                                <div className="rounded-sm border border-white/10 bg-black/25 p-3 text-xs text-gray-500">
                                    Last local result for {activeTrader.name}:{" "}
                                    {syncedQuestNames.join(", ")}
                                </div>
                            )}
                    </div>
                )}
            </div>
        </div>
    );
}

function SensitiveBackfillGate({
    questIds,
    getQuestName,
    onAllow,
    onDeny,
}: {
    questIds: string[];
    getQuestName: (questId: string) => string;
    onAllow: (questId: string) => void;
    onDeny: (questId: string) => void;
}) {
    return (
        <div className="rounded-sm border border-dashed border-red-500/60 px-3 py-3 text-sm text-gray-200">
            <div className="font-semibold text-red-400">
                Sensitive prerequisite backfill blocked.
            </div>
            <div className="mt-3 space-y-4">
                {questIds.map((questId) => (
                    <div key={questId}>
                        <div className="font-semibold">{getQuestName(questId)}</div>
                        <p className="mt-1 text-xs leading-5 text-gray-400">
                            {getSensitiveBackfillQuest(questId)?.warning}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => onDeny(questId)}
                                className="rounded-sm border border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-300 transition-colors hover:border-white/25 hover:text-white"
                            >
                                Ignore Pre-requisites
                            </button>
                            <button
                                type="button"
                                onClick={() => onAllow(questId)}
                                className="rounded-sm border border-red-500/50 bg-red-500/15 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-red-100 transition-colors hover:border-red-400 hover:bg-red-500/25 hover:text-white"
                            >
                                Complete Pre-requisites
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
