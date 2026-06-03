"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, MouseEvent, SetStateAction } from "react";
import type { Virtualizer } from "@tanstack/react-virtual";
import type { FullQuest } from "@/types";
import { QUEST_NAVIGATE_TO_QUEST_EVENT } from "../quest-deep-link";
import { QUEST_SCROLL_TO_TRADER_EVENT } from "./QuestsSidebar";
import type { TraderTreeMeta } from "./quest-tree-builder";
import {
    getBranchCollapseKey,
    getLinearCollapseKey,
    getTraderCollapseKey,
} from "./quest-tree-view-model";

const QUEST_HIGHLIGHT_DURATION_MS = 30_000;
const QUEST_SCROLL_TOP_OFFSET_VH = 0.3;

export interface QuestNavigationRequest {
    questId: string;
    requestId: number;
}

interface UseQuestTreeNavigationInput {
    filteredQuests: FullQuest[];
    questsById: Map<string, FullQuest>;
    treeMetaByTraderId: Map<string, TraderTreeMeta>;
    visibleTraders: FullQuest["trader"][];
    virtualizer: Virtualizer<Window, Element>;
    questNavigationRequest: QuestNavigationRequest | null;
    setCollapsedGroups: Dispatch<SetStateAction<Set<string>>>;
}

function scrollToQuest(questId: string) {
    const target = document.getElementById(`quest-${questId}`);
    if (!target) return false;

    const targetTop = target.getBoundingClientRect().top + window.scrollY;
    const offset = window.innerHeight * QUEST_SCROLL_TOP_OFFSET_VH;
    const top = Math.max(0, targetTop - offset);

    window.history.replaceState(null, "", `#quest-${questId}`);
    window.scrollTo({ top, behavior: "smooth" });
    return true;
}

export function useQuestTreeNavigation({
    filteredQuests,
    questsById,
    treeMetaByTraderId,
    visibleTraders,
    virtualizer,
    questNavigationRequest,
    setCollapsedGroups,
}: UseQuestTreeNavigationInput) {
    const [highlightedQuestId, setHighlightedQuestId] = useState<string | null>(null);
    const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const handledQuestNavigationRequestIdRef = useRef<number | null>(null);

    useEffect(() => {
        const handleScrollToTrader = (event: Event) => {
            const traderId = (event as CustomEvent<{ traderId?: string }>).detail?.traderId;
            if (!traderId) return;

            const index = visibleTraders.findIndex((trader) => trader.id === traderId);
            if (index === -1) return;

            virtualizer.scrollToIndex(index, { align: "start", behavior: "smooth" });
        };

        window.addEventListener(QUEST_SCROLL_TO_TRADER_EVENT, handleScrollToTrader);
        return () => window.removeEventListener(QUEST_SCROLL_TO_TRADER_EVENT, handleScrollToTrader);
    }, [visibleTraders, virtualizer]);

    const expandQuestPath = useCallback(
        (questId: string) => {
            const quest = questsById.get(questId);
            if (!quest) return;

            const treeMeta = treeMetaByTraderId.get(quest.trader.id);
            if (!treeMeta) return;

            setCollapsedGroups((current) => {
                const next = new Set(current);
                next.delete(getTraderCollapseKey(quest.trader.id));

                let currentQuestId: string | null = questId;
                while (currentQuestId) {
                    const parentQuestId: string | null =
                        treeMeta.parentOf.get(currentQuestId) ?? null;
                    if (!parentQuestId) break;

                    const siblings = treeMeta.childrenOf.get(parentQuestId) ?? [];
                    if (siblings.length > 1) {
                        next.delete(getBranchCollapseKey(parentQuestId));
                    } else if (siblings.length === 1) {
                        next.delete(getLinearCollapseKey(parentQuestId));
                    }

                    currentQuestId = parentQuestId;
                }

                return next;
            });
        },
        [questsById, setCollapsedGroups, treeMetaByTraderId],
    );

    const highlightQuest = useCallback(
        (questId: string, event?: MouseEvent<HTMLAnchorElement>) => {
            event?.preventDefault();
            setHighlightedQuestId(questId);

            requestAnimationFrame(() => {
                if (scrollToQuest(questId)) return;

                const quest = questsById.get(questId);
                const traderIndex = quest
                    ? visibleTraders.findIndex((trader) => trader.id === quest.trader.id)
                    : -1;
                if (traderIndex === -1) return;

                virtualizer.scrollToIndex(traderIndex, { align: "start" });
                requestAnimationFrame(() => requestAnimationFrame(() => scrollToQuest(questId)));
            });

            if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
            highlightTimeoutRef.current = setTimeout(() => {
                setHighlightedQuestId((current) => (current === questId ? null : current));
                highlightTimeoutRef.current = null;
            }, QUEST_HIGHLIGHT_DURATION_MS);
        },
        [questsById, visibleTraders, virtualizer],
    );

    const scrollToVisibleQuest = useCallback(
        (questId: string, event?: MouseEvent<HTMLAnchorElement>) => {
            const isVisible = filteredQuests.some((filteredQuest) => filteredQuest.id === questId);
            if (!isVisible) return false;

            expandQuestPath(questId);
            highlightQuest(questId, event);
            return true;
        },
        [expandQuestPath, filteredQuests, highlightQuest],
    );

    useEffect(() => {
        return () => {
            if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
        };
    }, []);

    useEffect(() => {
        const handleQuestNavigation = (event: Event) => {
            const questId = (event as CustomEvent<{ questId?: string }>).detail?.questId;
            if (!questId) return;
            scrollToVisibleQuest(questId);
        };

        window.addEventListener(QUEST_NAVIGATE_TO_QUEST_EVENT, handleQuestNavigation);
        return () =>
            window.removeEventListener(QUEST_NAVIGATE_TO_QUEST_EVENT, handleQuestNavigation);
    }, [scrollToVisibleQuest]);

    useEffect(() => {
        if (!questNavigationRequest) return;
        if (handledQuestNavigationRequestIdRef.current === questNavigationRequest.requestId) return;
        handledQuestNavigationRequestIdRef.current = questNavigationRequest.requestId;

        const frame = requestAnimationFrame(() =>
            scrollToVisibleQuest(questNavigationRequest.questId),
        );
        return () => cancelAnimationFrame(frame);
    }, [questNavigationRequest, scrollToVisibleQuest]);

    return {
        highlightedQuestId,
        scrollToVisibleQuest,
    };
}
