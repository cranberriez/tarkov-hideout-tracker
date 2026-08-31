"use client";

import { ChevronLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { FullQuest } from "@/types";
import type { MapViewTransform } from "@/features/maps/map-view-transform";
import { useUIStore } from "@/lib/stores/useUIStore";
import { cn } from "@/lib/utils";
import { clearQuestDeepLink, getQuestDeepLinkId } from "../quest-deep-link";
import {
    QuestCompactSearchBar,
    QuestFilterBar,
    QuestMobileToolbar,
    QuestTraderBar,
} from "./QuestFilterBar";
import { QuestListPane } from "./QuestListPane";
import { QuestActionBar } from "./QuestActionBar";
import { QuestDetailsPane } from "./QuestDetailsPane";
import { RaidPlannerPane } from "./RaidPlannerPane";
import { QuestVisualizerPane } from "./QuestVisualizerPane";
import { useQuestWorkspace } from "./QuestWorkspaceContext";

export function QuestWorkspace({ quests }: { quests: FullQuest[] }) {
    const { mode, plannerMapKey, questsById, selectedQuestId, setSelectedQuestId } = useQuestWorkspace();
    const [compactSearchOpen, setCompactSearchOpen] = useState(false);
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
        document.body.classList.toggle("quest-raid-planner-active", mode === "planner");
        return () => document.body.classList.remove("quest-raid-planner-active");
    }, [mode]);
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
                    : mode === "planner"
                      ? "h-dvh lg:h-[calc(100dvh-4.75rem)]"
                      : "h-[calc(100dvh-4rem)] sm:h-[calc(100dvh-4.75rem)]",
            )}
        >
            <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-1 overflow-hidden bg-[#0b0c0e] lg:grid-cols-[clamp(380px,34vw,560px)_minmax(0,1fr)]">
                <section className={cn(
                    "min-h-0 min-w-0 flex-col border-white/10 lg:flex lg:border-r",
                    mode === "details" && !selectedQuestId ? "flex" : "hidden",
                )}>
                    <QuestFilterBar />
                    <QuestTraderBar />
                    <QuestListPane />
                    {compactSearchOpen && (
                        <QuestCompactSearchBar onClose={() => setCompactSearchOpen(false)} />
                    )}
                    <QuestMobileToolbar
                        compactSearchOpen={compactSearchOpen}
                        onToggleCompactSearch={() => setCompactSearchOpen((open) => !open)}
                    />
                </section>
                <section className={cn(
                    "min-h-0 min-w-0 flex-col lg:flex",
                    mode !== "details" || selectedQuestId ? "flex" : "hidden",
                )}>
                    <QuestActionBar quests={quests} />
                    {mode === "details" && selectedQuestId && (
                        <button
                            type="button"
                            onClick={() => setSelectedQuestId(null)}
                            className="flex h-12 shrink-0 items-center gap-2 border-b border-white/10 bg-[#101113] px-4 text-xs font-medium text-gray-300 transition-colors hover:text-white lg:hidden"
                        >
                            <ChevronLeft size={16} /> Back to quests
                        </button>
                    )}
                    {mode === "planner" ? (
                        <RaidPlannerPane
                            rememberedView={plannerMapKey
                                ? plannerViews.get(plannerMapKey) ?? null
                                : null}
                            onViewChange={rememberPlannerView}
                        />
                    ) : mode === "visualizer" ? (
                        <QuestVisualizerPane />
                    ) : <QuestDetailsPane />}
                </section>
            </div>
        </main>
    );
}
