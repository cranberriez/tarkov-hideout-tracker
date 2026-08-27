"use client";

import { useEffect } from "react";
import type { FullQuest } from "@/types";
import { clearQuestDeepLink, getQuestDeepLinkId } from "../quest-deep-link";
import { QuestFilterBar } from "./QuestFilterBar";
import { QuestListPane } from "./QuestListPane";
import { QuestActionBar } from "./QuestActionBar";
import { QuestDetailsPane } from "./QuestDetailsPane";
import { RaidPlannerPane } from "./RaidPlannerPane";
import { useQuestWorkspace } from "./QuestWorkspaceContext";

export function QuestWorkspace({ quests }: { quests: FullQuest[] }) {
    const { mode, questsById, setSelectedQuestId } = useQuestWorkspace();
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
            className="flex h-[calc(100dvh-4rem)] min-h-0 shrink-0 overflow-hidden sm:h-[calc(100dvh-4.75rem)]"
        >
            <div className="grid min-h-0 flex-1 grid-rows-2 overflow-hidden bg-[#0b0c0e] lg:grid-cols-[clamp(380px,34vw,560px)_minmax(0,1fr)] lg:grid-rows-1">
                <section className="flex min-h-0 min-w-0 flex-col border-b border-white/10 lg:border-b-0 lg:border-r">
                    <QuestFilterBar />
                    <QuestListPane />
                </section>
                <section className="flex min-h-0 min-w-0 flex-col">
                    <QuestActionBar quests={quests} />
                    {mode === "planner" ? <RaidPlannerPane /> : <QuestDetailsPane />}
                </section>
            </div>
        </main>
    );
}
