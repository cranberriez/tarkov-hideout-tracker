import type { FullQuest } from "@/types/quests";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import seriesData from "../data/quest-series.json";
import { isEssentialQuestOverride } from "./quest-trader-tab-overrides";

export interface QuestSeriesMember {
    questId: string;
    order: number;
}

export interface QuestSeriesDefinition {
    id: string;
    name: string;
    traderId: string;
    members: QuestSeriesMember[];
    /** Cross-trader membership is unusual and must be explicit in the manifest. */
    allowCrossTrader?: boolean;
    /** Place members in the issuing trader's Essential area. */
    essential?: boolean;
    /** Correct provider metadata and identify series unavailable without Lightkeeper. */
    lightkeeperRequired?: boolean;
}

export interface QuestSeriesManifest {
    version: number;
    series: QuestSeriesDefinition[];
}

export interface QuestSeriesMembership {
    series: QuestSeriesDefinition;
    order: number;
}

export const QUEST_SERIES_MANIFEST = seriesData as QuestSeriesManifest;

const membershipByQuestId = new Map<string, QuestSeriesMembership>();
for (const series of QUEST_SERIES_MANIFEST.series) {
    for (const member of series.members) {
        membershipByQuestId.set(member.questId, { series, order: member.order });
    }
}

export function getQuestSeriesMembership(questId: string) {
    return membershipByQuestId.get(questId) ?? null;
}

export function getEssentialQuestSeriesMembership(questId: string) {
    const membership = getQuestSeriesMembership(questId);
    return membership?.series.essential ? membership : null;
}

export function isEssentialQuest(questId: string) {
    return !!getEssentialQuestSeriesMembership(questId) || isEssentialQuestOverride(questId);
}

/**
 * Apply reviewed series metadata without mutating provider or cached quest data.
 */
export function applyQuestSeriesMetadata(quests: FullQuest[]) {
    return quests.map((quest) => {
        const membership = getQuestSeriesMembership(quest.id);
        if (!membership?.series.lightkeeperRequired || quest.lightkeeperRequired) return quest;
        return { ...quest, lightkeeperRequired: true };
    });
}

function isLightkeeperTrader(quest: FullQuest) {
    return quest.trader.normalizedName === "lightkeeper" ||
        quest.trader.name.trim().toLowerCase() === "lightkeeper";
}

/**
 * Seasonal/KORD has no Lightkeeper. Remove his quests and all prerequisite
 * series marked as Lightkeeper progression before building any display or item
 * demand indexes.
 */
export function prepareQuestSeriesForGameMode(
    quests: FullQuest[],
    gameMode: TarkovJsonGameMode,
) {
    const prepared = applyQuestSeriesMetadata(quests);
    if (gameMode !== "pvp-season") return prepared;
    return prepared.filter((quest) => !quest.lightkeeperRequired && !isLightkeeperTrader(quest));
}
