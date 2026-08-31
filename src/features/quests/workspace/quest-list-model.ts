import type { FullQuest } from "@/types";
import { getQuestTraderTabLoyaltyLevel } from "../../../lib/utils/quest-trader-completion-gates";
import { isEssentialQuest } from "../../../lib/utils/quest-series";
import { buildQuestUnlockImpactMap, sortQuestsForQuestView, type QuestSortMode } from "../quest-sorting";
import { buildEssentialQuestSeries, type QuestWorkspaceStatusInfo } from "./quest-workspace-utils";

export type QuestListEntry =
    | { kind: "quest"; questId: string }
    | QuestListGroup
    | QuestListEssentialCategory
    | QuestListEssentialSeries;

export interface QuestListGroup {
    kind: "group";
    id: string;
    label: string;
    count: number;
    image?: string | null;
    nested?: boolean;
    entries: QuestListEntry[];
}

export interface QuestListEssentialCategory {
    kind: "essential-category";
    id: string;
    count: number;
    entries: QuestListEntry[];
}

export interface QuestListEssentialSeries {
    kind: "essential-series";
    id: string;
    title: string;
    questIds: string[];
    activeQuestIds: string[];
}

export interface QuestListModel {
    entries: QuestListEntry[];
    questCount: number;
}

export interface BuildQuestListModelOptions {
    quests: FullQuest[];
    allQuests: FullQuest[];
    statusByQuestId: ReadonlyMap<string, QuestWorkspaceStatusInfo>;
    groupByTrader: boolean;
    groupByLoyaltyLevel: boolean;
}

export interface BuildSortedQuestListModelOptions extends BuildQuestListModelOptions {
    sortMode: QuestSortMode;
    questOrderById?: ReadonlyMap<string, number>;
    unlockImpactById?: ReadonlyMap<string, number>;
}

export function buildSortedQuestListModel({
    quests,
    allQuests,
    statusByQuestId,
    groupByTrader,
    groupByLoyaltyLevel,
    sortMode,
    questOrderById = new Map(allQuests.map((quest, index) => [quest.id, index])),
    unlockImpactById = buildQuestUnlockImpactMap(allQuests),
}: BuildSortedQuestListModelOptions): QuestListModel {
    return buildQuestListModel({
        quests: sortQuestsForQuestView(
            quests,
            sortMode,
            new Map(questOrderById),
            new Map(unlockImpactById),
        ),
        allQuests,
        statusByQuestId,
        groupByTrader,
        groupByLoyaltyLevel,
    });
}

export function buildQuestListModel({
    quests,
    allQuests,
    statusByQuestId,
    groupByTrader,
    groupByLoyaltyLevel,
}: BuildQuestListModelOptions): QuestListModel {
    const essentialSeries = buildEssentialQuestSeries(
        allQuests.filter((quest) => isEssentialQuest(quest.id)),
    );
    const essentialSeriesByQuestId = new Map<string, (typeof essentialSeries)[number]>();
    for (const series of essentialSeries) {
        for (const questId of series.questIds) essentialSeriesByQuestId.set(questId, series);
    }

    const buildEssentialCategory = (
        essentialQuests: FullQuest[],
        parentId: string,
    ): QuestListEssentialCategory | null => {
        if (essentialQuests.length === 0) return null;

        const questsBySeriesId = new Map<string, FullQuest[]>();
        const ungroupedQuests: FullQuest[] = [];
        for (const quest of essentialQuests) {
            const series = essentialSeriesByQuestId.get(quest.id);
            if (!series) {
                ungroupedQuests.push(quest);
                continue;
            }
            questsBySeriesId.set(series.id, [...(questsBySeriesId.get(series.id) ?? []), quest]);
        }

        const entries: QuestListEntry[] = [];
        for (const series of essentialSeries) {
            const visibleSeriesQuests = questsBySeriesId.get(series.id);
            if (!visibleSeriesQuests) continue;

            const visibleQuestIds = new Set(visibleSeriesQuests.map((quest) => quest.id));
            const questIds = series.questIds.filter((questId) => visibleQuestIds.has(questId));
            entries.push({
                kind: "essential-series",
                id: `${parentId}:essential-series:${series.id}`,
                title: series.title,
                questIds,
                activeQuestIds: questIds.filter(
                    (questId) => statusByQuestId.get(questId)?.status === "active",
                ),
            });
        }
        entries.push(...ungroupedQuests.map(toQuestEntry));

        return {
            kind: "essential-category",
            id: `${parentId}:essential`,
            count: essentialQuests.length,
            entries,
        };
    };

    const buildRowsWithEssential = (groupQuests: FullQuest[], parentId: string) => {
        const regularEntries = groupQuests
            .filter((quest) => !isEssentialQuest(quest.id))
            .map(toQuestEntry);
        const category = buildEssentialCategory(
            groupQuests.filter((quest) => isEssentialQuest(quest.id)),
            parentId,
        );
        return category ? [...regularEntries, category] : regularEntries;
    };

    const buildLoyaltyGroups = (groupQuests: FullQuest[], parentId = "all") => {
        const groups = new Map<number | "essential", FullQuest[]>();
        for (const quest of groupQuests) {
            const key = isEssentialQuest(quest.id)
                ? "essential"
                : getQuestTraderTabLoyaltyLevel(quest);
            groups.set(key, [...(groups.get(key) ?? []), quest]);
        }

        return [...groups.entries()]
            .sort(([left], [right]) => {
                if (left === "essential") return 1;
                if (right === "essential") return -1;
                return left - right;
            })
            .flatMap<QuestListEntry>(([key, loyaltyQuests]) => {
                const id = `${parentId}:loyalty-level:${key}`;
                if (key === "essential") {
                    const category = buildEssentialCategory(loyaltyQuests, id);
                    return category ? [category] : [];
                }
                return [{
                    kind: "group",
                    id,
                    label: `Loyalty level ${key}`,
                    count: loyaltyQuests.length,
                    nested: true,
                    entries: loyaltyQuests.map(toQuestEntry),
                }];
            });
    };

    let entries: QuestListEntry[];
    if (groupByTrader) {
        const traders = new Map<string, FullQuest[]>();
        for (const quest of quests) {
            traders.set(quest.trader.id, [...(traders.get(quest.trader.id) ?? []), quest]);
        }
        entries = [...traders.entries()].map(([traderId, traderQuests]) => {
            const trader = traderQuests[0].trader;
            const id = `trader:${traderId}`;
            return {
                kind: "group",
                id,
                label: trader.name,
                count: traderQuests.length,
                image: trader.image4xLink ?? trader.imageLink,
                entries: groupByLoyaltyLevel
                    ? buildLoyaltyGroups(traderQuests, id)
                    : buildRowsWithEssential(traderQuests, id),
            };
        });
    } else if (groupByLoyaltyLevel) {
        entries = buildLoyaltyGroups(quests);
    } else {
        entries = buildRowsWithEssential(quests, "all");
    }

    return { entries, questCount: quests.length };
}

function toQuestEntry(quest: FullQuest): QuestListEntry {
    return { kind: "quest", questId: quest.id };
}
