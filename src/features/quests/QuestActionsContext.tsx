"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useUserStore } from "@/lib/stores/useUserStore";
import type { FullQuest } from "@/types/quests";
import type { ItemSummary } from "@/types/items";
import type { QuestDataIndex } from "./quest-data-index";
import { useUIStore } from "@/lib/stores/useUIStore";
import { collectCompleteCascade, collectUncompleteCascade } from "./quest-cascade";
import { getAutoFailedQuestIds, questCanFail } from "@/lib/quests/quest-failures";

interface QuestActionsContextValue {
    itemById: Readonly<Record<string, ItemSummary>>;
    questsById: Map<string, FullQuest>;
    leadsToByQuestId: Map<string, string[]>;

    requestToggleQuestCompletion: (questId: string) => void;
    requestFailQuest: (questId: string) => void;
    requestResetQuestStatus: (questId: string) => void;
    onItemClick: ((itemId: string) => void) | null;
}

const QuestActionsContext = createContext<QuestActionsContextValue | null>(null);

export function useQuestActions() {
    const ctx = useContext(QuestActionsContext);
    if (!ctx) throw new Error("useQuestActions must be used within QuestActionsProvider");
    return ctx;
}

export function QuestActionsProvider({
    questDataIndex,
    itemById,
    children,
    onItemClick,
}: {
    questDataIndex: QuestDataIndex;
    itemById: Readonly<Record<string, ItemSummary>>;
    children: ReactNode;
    onItemClick?: (itemId: string) => void;
}) {
    const { questsById, leadsToByQuestId, failureMap } = questDataIndex;

    const requestToggleQuestCompletion = useCallback((questId: string) => {
        const userState = useUserStore.getState();
        const isCurrentlyComplete = !!userState.completedQuests[questId];

        if (isCurrentlyComplete) {
            const cascade = collectUncompleteCascade(questId, {
                questsById,
                completedQuests: userState.completedQuests,
                leadsToByQuestId,
            });

            if (cascade.toUncomplete.length <= 1) {
                userState.applyQuestCompletionChange({ uncomplete: cascade.toUncomplete });
                return;
            }

            useUIStore.getState().openQuestCascadeRequest({
                mode: "uncomplete",
                rootQuestId: questId,
                questIds: cascade.toUncomplete,
                crossTraderQuestIds: cascade.crossTraderQuestIds,
                sensitiveQuestIds: [],
            });
            return;
        }

        const cascade = collectCompleteCascade(questId, {
            questsById,
            completedQuests: userState.completedQuests,
        });

        if (cascade.toComplete.length === 0) return;

        const autoFailedQuestIds = getAutoFailedQuestIds(
            cascade.toComplete,
            failureMap,
            userState.failedQuests,
        );
        const rootAutoFailedQuestIds = getAutoFailedQuestIds(
            [questId],
            failureMap,
            userState.failedQuests,
        );

        const shouldConfirm =
            cascade.crossTraderQuestIds.length > 0 ||
            cascade.toComplete.length > 10 ||
            cascade.sensitiveQuestIds.length > 0 ||
            autoFailedQuestIds.length > 0;

        if (!shouldConfirm) {
            userState.applyQuestCompletionChange({
                complete: cascade.toComplete,
                fail: autoFailedQuestIds,
            });
            return;
        }

        useUIStore.getState().openQuestCascadeRequest({
            mode: "complete",
            rootQuestId: questId,
            questIds: cascade.toComplete,
            autoFailedQuestIds,
            rootAutoFailedQuestIds,
            crossTraderQuestIds: cascade.crossTraderQuestIds,
            sensitiveQuestIds: cascade.sensitiveQuestIds,
        });
    }, [failureMap, leadsToByQuestId, questsById]);

    const requestFailQuest = useCallback((questId: string) => {
        const quest = questsById.get(questId);
        if (!quest || !questCanFail(quest)) return;
        useUserStore.getState().applyQuestFailureChange({ fail: [questId] });
    }, [questsById]);

    const requestResetQuestStatus = useCallback((questId: string) => {
        const userState = useUserStore.getState();
        const isCurrentlyComplete = !!userState.completedQuests[questId];
        const isCurrentlyFailed = !!userState.failedQuests[questId];

        if (!isCurrentlyComplete && !isCurrentlyFailed) return;

        if (!isCurrentlyComplete) {
            userState.applyQuestFailureChange({ unFail: [questId] });
            return;
        }

        const cascade = collectUncompleteCascade(questId, {
            questsById,
            completedQuests: userState.completedQuests,
            leadsToByQuestId,
        });

        if (cascade.toUncomplete.length <= 1) {
            userState.applyQuestCompletionChange({
                uncomplete: cascade.toUncomplete,
                unFail: [questId],
            });
            return;
        }

        useUIStore.getState().openQuestCascadeRequest({
            mode: "uncomplete",
            rootQuestId: questId,
            questIds: cascade.toUncomplete,
            crossTraderQuestIds: cascade.crossTraderQuestIds,
            sensitiveQuestIds: [],
        });
    }, [leadsToByQuestId, questsById]);

    const value = useMemo<QuestActionsContextValue>(() => ({
        itemById,
        questsById,
        leadsToByQuestId,
        requestToggleQuestCompletion,
        requestFailQuest,
        requestResetQuestStatus,
        onItemClick: onItemClick ?? null,
    }), [
        itemById,
        questsById,
        leadsToByQuestId,
        requestToggleQuestCompletion,
        requestFailQuest,
        requestResetQuestStatus,
        onItemClick,
    ]);

    return <QuestActionsContext.Provider value={value}>{children}</QuestActionsContext.Provider>;
}
