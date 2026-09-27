"use client";

import { QuestDetailsPane } from "./QuestDetailsPane";
import { QuestNotFound } from "./QuestSelectionPrompt";
import { useQuestWorkspace } from "./QuestWorkspaceContext";

/**
 * `/quests/[questId]` content. Reuses the workspace's loaded quest set, so details
 * appear immediately and are independent of the current list filters.
 */
export function QuestDetailRoute({ questId }: { questId: string }) {
    const { questsById } = useQuestWorkspace();
    const quest = questsById.get(questId);
    if (!quest) {
        return <QuestNotFound message="This quest is not part of the loaded quest data for the current game mode." />;
    }
    return <QuestDetailsPane key={quest.id} quest={quest} />;
}
