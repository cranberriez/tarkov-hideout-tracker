import overrideData from "../data/quest-trader-tab-overrides.json";

export type QuestTraderTab = 1 | 2 | 3 | 4 | "essential";

interface QuestTraderTabOverrideRecord {
    traderTab: QuestTraderTab;
}

const overrideValues = overrideData.values as Record<
    string,
    QuestTraderTabOverrideRecord | undefined
>;

/**
 * Return the reviewed in-game trader tab for a quest ID.
 *
 * This is deliberately a small overlay on the upstream quest payload. Removing
 * the JSON entry (or this lookup at its call sites) restores provider-derived
 * behavior without changing quest IDs, cached payloads, or persisted progress.
 */
export function getQuestTraderTabOverride(questId: string): QuestTraderTab | null {
    const value = overrideValues[questId]?.traderTab;
    return value === "essential" || value === 1 || value === 2 || value === 3 || value === 4
        ? value
        : null;
}

export function getQuestLoyaltyLevelOverride(questId: string): 1 | 2 | 3 | 4 | null {
    const value = getQuestTraderTabOverride(questId);
    return typeof value === "number" ? value : null;
}

export function isEssentialQuestOverride(questId: string) {
    return getQuestTraderTabOverride(questId) === "essential";
}
