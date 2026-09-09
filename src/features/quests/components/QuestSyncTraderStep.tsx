"use client";

import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useQuestsContext } from "../QuestsContext";
import { QuestSyncSelectableQuestRow } from "./QuestSyncSelectableQuestRow";
import { QuestListByTrader } from "./QuestListByTrader";
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
    const [enableInference, setEnableInference] = useState(true);
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
    const { completedQuests, questTraderLoyaltyLevels, setQuestTraderLoyaltyLevel } = useUserStore(
        useShallow((state) => ({
            completedQuests: state.completedQuests,
            questTraderLoyaltyLevels: state.questTraderLoyaltyLevels,
            setQuestTraderLoyaltyLevel: state.setQuestTraderLoyaltyLevel,
        })),
    );

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
    const syncedQuestIds = activeTrader ? (latestResultByTrader[activeTrader.id] ?? []) : [];
    const hasNoOpSyncResult = activeTrader ? (latestNoOpByTrader[activeTrader.id] ?? false) : false;
    const previewResult = (() => {
        if (!activeTrader || selectedQuestIds.length === 0) return null;
        return previewTraderSelection(
            activeTrader.id,
            selectedQuestIds,
            enableInference,
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
                    className="text-xs font-semibold uppercase tracking-wide text-subtle-foreground transition-colors hover:text-foreground"
                >
                    Back
                </button>
                <div className="space-y-1">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground">
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
                                    ? "border-brand/40 bg-brand/10 text-foreground"
                                    : "border-highlight/10 bg-shadow/20 text-muted-foreground hover:border-highlight/20 hover:text-foreground"
                            }`}
                        >
                            <span>{trader.name}</span>
                            {latestResultByTrader[trader.id] && (
                                <span className="text-[10px] uppercase tracking-wide text-success">
                                    Synced
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            <div className="min-w-0 rounded-sm border border-highlight/10 bg-shadow/20 p-4">
                {!activeTrader ? (
                    <div className="flex min-h-64 items-center justify-center text-sm text-subtle-foreground">
                        Select a trader.
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex flex-col gap-3 border-b border-highlight/10 pb-4 md:flex-row md:items-center md:justify-between">
                            <div className="space-y-1">
                                <h4 className="text-lg font-semibold text-foreground">
                                    {activeTrader.name}
                                </h4>
                                <p className="text-xs text-subtle-foreground">
                                    Search for and select quests that are currently active to
                                    auto-complete prerequisites.
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex gap-1.5">
                                    {LOYALTY_LEVELS.map((level) => (
                                        <button
                                            key={level}
                                            onClick={() =>
                                                setQuestTraderLoyaltyLevel(activeTrader.id, level)
                                            }
                                            className={`rounded-sm px-3 py-2 text-sm transition-colors ${
                                                loyaltyLevel === level
                                                    ? "bg-brand text-inverse"
                                                    : "border border-highlight/10 bg-shadow/30 text-muted-foreground hover:border-highlight/20 hover:text-foreground"
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
                                className="w-full rounded-sm border border-highlight/10 bg-shadow/40 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-subtle-foreground focus:border-brand/50"
                            />
                            <div className="text-xs text-subtle-foreground">
                                {syncCandidates.length} total quest
                                {syncCandidates.length === 1 ? "" : "s"}
                            </div>
                            {showNetworkProviderWarning && (
                                <div className="rounded-sm border border-danger/35 bg-danger/12 px-3 py-2 text-xs font-semibold text-danger">
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
                                    <div className="rounded-sm border border-dashed border-highlight/10 px-3 py-6 text-center text-sm text-subtle-foreground">
                                        No quests match the current search.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2 border-t border-highlight/10 pt-4">
                            <label className="flex items-start gap-2 px-3 py-2 text-xs text-foreground">
                                <input
                                    type="checkbox"
                                    checked={enableInference}
                                    onChange={(event) => setEnableInference(event.target.checked)}
                                    className="h-4 w-4 accent-brand"
                                />
                                <span>
                                    Infer same-trader completed quests. Branching quests are not
                                    auto-completed and will be listed for manual review.
                                </span>
                            </label>
                            <div className="flex flex-wrap items-center gap-3">
                                <button
                                    onClick={() => {
                                        const result = syncTraderSelection(
                                            activeTrader.id,
                                            selectedQuestIds,
                                            enableInference,
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
                                            ? "bg-brand text-inverse hover:bg-brand-hover"
                                            : "cursor-not-allowed border border-highlight/10 bg-shadow/30 text-subtle-foreground"
                                    }`}
                                >
                                    Sync {activeTrader.name}
                                </button>
                                <span className="text-xs text-subtle-foreground">
                                    {selectedQuestIds.length} selected
                                </span>
                            </div>
                        </div>

                        {hasNoOpSyncResult && (
                            <div className="rounded-sm border border-warning/20 bg-warning/8 px-3 py-2 text-xs text-warning">
                                This sync did not auto-complete any additional quests. The previous
                                sync result was kept so you can still undo it.
                            </div>
                        )}

                        {previewResult && (
                            <div className="space-y-3 rounded-sm border border-highlight/10 bg-shadow/30 p-4">
                                <div className="space-y-1">
                                    <h5 className="text-sm font-semibold text-foreground">
                                        Sync Preview
                                    </h5>
                                    <p className="text-xs text-subtle-foreground">
                                        {previewResult.completedIds.length > 0 ||
                                        previewResult.autoFailedQuestIds.length > 0 ||
                                        previewResult.skippedBranchingQuestIds.length > 0
                                            ? `Will complete ${previewResult.completedIds.length} quest${previewResult.completedIds.length === 1 ? "" : "s"}, fail ${previewResult.autoFailedQuestIds.length} quest${previewResult.autoFailedQuestIds.length === 1 ? "" : "s"}, and leave ${previewResult.skippedBranchingQuestIds.length} branching quest${previewResult.skippedBranchingQuestIds.length === 1 ? "" : "s"} unchanged.`
                                            : "No quests would be completed with the current selection."}
                                    </p>
                                </div>

                                {previewResult.autoFailedQuestIds.length > 0 && (
                                    <div className="space-y-1">
                                        <div className="text-[10px] font-semibold uppercase tracking-wide text-danger">
                                            Will Fail
                                        </div>
                                        <QuestListByTrader
                                            questIds={previewResult.autoFailedQuestIds}
                                            questsById={questsById}
                                            emptyMessage="No quests will fail."
                                        />
                                    </div>
                                )}

                                {previewResult.skippedBranchingQuestIds.length > 0 && (
                                    <div className="space-y-1">
                                        <div className="text-[10px] font-semibold uppercase tracking-wide text-warning">
                                            Needs Branch Choice
                                        </div>
                                        <p className="text-xs text-subtle-foreground">
                                            These likely completed quests can fail another quest, so
                                            sync leaves them unchanged until you choose the branch.
                                        </p>
                                        <QuestListByTrader
                                            questIds={previewResult.skippedBranchingQuestIds}
                                            questsById={questsById}
                                            emptyMessage="No branching quests need review."
                                        />
                                    </div>
                                )}

                                {previewResult.prerequisiteCompletedIds.length > 0 && (
                                    <div className="space-y-1">
                                        <div className="text-[10px] font-semibold uppercase tracking-wide text-subtle-foreground">
                                            Prerequisites
                                        </div>
                                        <QuestListByTrader
                                            questIds={previewResult.prerequisiteCompletedIds}
                                            questsById={questsById}
                                            emptyMessage="No prerequisite quests will be completed."
                                        />
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
                                        <div className="text-[10px] font-semibold uppercase tracking-wide text-subtle-foreground">
                                            Inferred
                                        </div>
                                        <QuestListByTrader
                                            questIds={previewResult.inferredCompletedIds}
                                            questsById={questsById}
                                            emptyMessage="No inferred quests will be completed."
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {lastQuestSyncAction?.traderId === activeTrader.id &&
                            lastQuestSyncAction.completedIds.length > 0 && (
                                <div className="flex flex-wrap items-center gap-3 rounded-sm border border-info/20 bg-info/8 px-3 py-3 text-sm text-info">
                                    <span>
                                        Last sync completed{" "}
                                        {lastQuestSyncAction.completedIds.length} quest
                                        {lastQuestSyncAction.completedIds.length === 1 ? "" : "s"}
                                        {lastQuestSyncAction.autoFailedQuestIds.length > 0
                                            ? ` and failed ${lastQuestSyncAction.autoFailedQuestIds.length} quest${lastQuestSyncAction.autoFailedQuestIds.length === 1 ? "" : "s"}`
                                            : ""}
                                        .
                                    </span>
                                    <button
                                        onClick={handleCloseAndJumpToTrader}
                                        className="rounded-sm border border-info/30 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-info transition-colors hover:border-info/50 hover:text-foreground"
                                    >
                                        Close And Jump To {activeTrader.name}
                                    </button>
                                </div>
                            )}

                        {syncedQuestIds.length > 0 &&
                            lastQuestSyncAction?.traderId !== activeTrader.id && (
                                <div className="space-y-2 rounded-sm border border-highlight/10 bg-shadow/25 p-3">
                                    <div className="text-[10px] font-semibold uppercase tracking-wide text-subtle-foreground">
                                        Last local result for {activeTrader.name}
                                    </div>
                                    <QuestListByTrader
                                        questIds={syncedQuestIds}
                                        questsById={questsById}
                                        emptyMessage="No quests will change."
                                    />
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
        <div className="rounded-sm border border-dashed border-danger/60 px-3 py-3 text-sm text-foreground">
            <div className="font-semibold text-danger">
                Sensitive prerequisite backfill blocked.
            </div>
            <div className="mt-3 space-y-4">
                {questIds.map((questId) => (
                    <div key={questId}>
                        <div className="font-semibold">{getQuestName(questId)}</div>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            {getSensitiveBackfillQuest(questId)?.warning}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => onDeny(questId)}
                                className="rounded-sm border border-highlight/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-foreground transition-colors hover:border-highlight/25 hover:text-foreground"
                            >
                                Ignore Pre-requisites
                            </button>
                            <button
                                type="button"
                                onClick={() => onAllow(questId)}
                                className="rounded-sm border border-danger/50 bg-danger/15 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-danger transition-colors hover:border-danger hover:bg-danger/25 hover:text-foreground"
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
