import overrideData from "../data/quest-faction-overrides.json";

export type QuestFactionOverride = "USEC" | "BEAR";

interface QuestFactionOverrideRecord {
    factionName: QuestFactionOverride;
}

const overrideValues = overrideData.values as Record<
    string,
    QuestFactionOverrideRecord | undefined
>;

/** Return a reviewed faction correction for a quest whose provider data is inaccurate. */
export function getQuestFactionOverride(questId: string): QuestFactionOverride | null {
    const factionName = overrideValues[questId]?.factionName;
    return factionName === "USEC" || factionName === "BEAR" ? factionName : null;
}

/**
 * Apply reviewed faction corrections without mutating the cached provider payload.
 * Unaffected quest objects retain their original identity.
 */
export function applyQuestFactionOverrides<
    T extends { id: string; factionName?: string | null },
>(quests: T[]): T[] {
    return quests.map((quest) => {
        const factionName = getQuestFactionOverride(quest.id);
        return factionName === null || factionName === quest.factionName
            ? quest
            : { ...quest, factionName };
    });
}
