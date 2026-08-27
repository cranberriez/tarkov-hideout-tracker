"use client";

import { useCallback, useEffect, useState } from "react";
import type { FullQuest } from "@/types";
import type { MapViewTransform } from "@/features/maps/map-view-transform";
import { useUIStore } from "@/lib/stores/useUIStore";
import { cn } from "@/lib/utils";
import { clearQuestDeepLink, getQuestDeepLinkId } from "../quest-deep-link";
import { QuestFilterBar, QuestTraderBar } from "./QuestFilterBar";
import { QuestListPane } from "./QuestListPane";
import { QuestActionBar } from "./QuestActionBar";
import { QuestDetailsPane } from "./QuestDetailsPane";
import { RaidPlannerPane } from "./RaidPlannerPane";
import { useQuestWorkspace } from "./QuestWorkspaceContext";

export function QuestWorkspace({ quests }: { quests: FullQuest[] }) {
    const { mode, plannerMapKey, questsById, setSelectedQuestId } = useQuestWorkspace();
    const [plannerViews, setPlannerViews] = useState(() => new Map<string, MapViewTransform>());
    const rememberPlannerView = useCallback((mapKey: string, view: MapViewTransform | null) => {
        setPlannerViews((current) => {
            const next = new Map(current);
            if (view) next.set(mapKey, view);
            else next.delete(mapKey);
            return next;
        });
    }, []);
    const isMainNavHidden = useUIStore((state) => state.isMainNavHidden);
    useEffect(() => {
        document.body.classList.add("quest-workspace-active");
        return () => document.body.classList.remove("quest-workspace-active");
    }, []);
    useEffect(() => {
        const questId = getQuestDeepLinkId(window.location);
        if (!questId || !questsById.has(questId)) return;
        clearQuestDeepLink();
        setSelectedQuestId(questId);
        requestAnimationFrame(() => document.getElementById(`quest-workspace-${questId}`)?.scrollIntoView({ block: "center" }));
    }, [questsById, setSelectedQuestId]);
    return (
        <main
            data-quest-workspace
            className={cn(
                "flex min-h-0 shrink-0 overflow-hidden",
                isMainNavHidden
                    ? "h-dvh"
                    : "h-[calc(100dvh-4rem)] sm:h-[calc(100dvh-4.75rem)]",
            )}
        >
            <div className="grid min-h-0 flex-1 grid-rows-2 overflow-hidden bg-[#0b0c0e] lg:grid-cols-[clamp(380px,34vw,560px)_minmax(0,1fr)] lg:grid-rows-1">
                <section className="flex min-h-0 min-w-0 flex-col border-b border-white/10 lg:border-b-0 lg:border-r">
                    <QuestFilterBar />
                    <QuestTraderBar />
                    <QuestListPane />
                </section>
                <section className="flex min-h-0 min-w-0 flex-col">
                    <QuestActionBar quests={quests} />
                    {mode === "planner" ? (
                        <RaidPlannerPane
                            rememberedView={plannerMapKey
                                ? plannerViews.get(plannerMapKey) ?? null
                                : null}
                            onViewChange={rememberPlannerView}
                        />
                    ) : <QuestDetailsPane />}
                </section>
            </div>
        </main>
    );
}
