"use client";

import { useQuestsContext } from "../QuestsContext";
import { QuestCard } from "../QuestCard";

export function QuestsList() {
    const { quests, filteredQuests, questsById, leadsToByQuestId, completedCount } = useQuestsContext();

    return (
        <>
            <div className="flex items-center gap-3 px-1 text-xs text-gray-500">
                <span>{filteredQuests.length} quests</span>
                <span className="text-gray-600">·</span>
                <span>
                    {completedCount}/{quests.length} completed
                </span>
            </div>

            <div className="space-y-1">
                {filteredQuests.map((quest) => (
                    <QuestCard
                        key={quest.id}
                        quest={quest}
                        prerequisiteNames={quest.taskRequirements.map(
                            (req) => questsById.get(req.task.id)?.name ?? req.task.name,
                        )}
                        leadsToNames={(leadsToByQuestId.get(quest.id) ?? []).map(
                            (id) => questsById.get(id)?.name ?? id,
                        )}
                    />
                ))}
                {filteredQuests.length === 0 && (
                    <div className="flex items-center justify-center py-16 text-gray-600 text-sm">
                        No quests match the current filters.
                    </div>
                )}
            </div>
        </>
    );
}
