import { toQuestAvailabilityQuest } from "../../lib/utils/quest-availability";
import {
    buildQuestAnyOfGroups,
    buildQuestItemIndex,
    buildQuestRewardIndex,
} from "../../lib/utils/quest-item-index";
import { orderQuestsByPrerequisites } from "../../lib/utils/quest-ordering";
import { prepareQuestDataForMode } from "../../lib/utils/quest-preparation";
import { excludeRemovedQuests } from "../../lib/utils/removed-quests";
import type { TarkovDataRepository } from "@/server/repositories/tarkov-data/types";
import type { TarkovDataMode } from "@/types/common";
import type {
    ItemHideoutRequirementRelation,
    ItemRelationsPayload,
} from "@/types/contracts";
import type { FullQuest } from "@/types/quests";
import { dedupeIds, getDefaultRepository } from "./query-utils";

function getHideoutRequirements(
    itemId: string,
    stations: Awaited<
        ReturnType<TarkovDataRepository["hideout"]["getStations"]>
    >["data"],
): ItemHideoutRequirementRelation[] {
    return stations.flatMap((station) => {
        const stationMaxLevel = station.levels.reduce(
            (highest, level) => Math.max(highest, level.level),
            0,
        );
        return station.levels.flatMap((level) =>
            level.itemRequirements.flatMap((requirement) =>
                requirement.itemId === itemId
                    ? [
                          {
                              station: {
                                  id: station.id,
                                  name: station.name,
                                  normalizedName: station.normalizedName,
                                  ...(station.imageLink
                                      ? { imageLink: station.imageLink }
                                      : {}),
                              },
                              stationMaxLevel,
                              level: level.level,
                              requirement,
                          },
                      ]
                    : [],
            ),
        );
    });
}

function getAvailabilityClosure(
    quests: readonly FullQuest[],
    referencedQuestIds: readonly string[],
): FullQuest[] {
    const questsById = new Map(quests.map((quest) => [quest.id, quest]));
    const includedIds = new Set<string>();

    function includeWithPrerequisites(questId: string) {
        if (includedIds.has(questId)) return;
        const quest = questsById.get(questId);
        if (!quest) return;
        includedIds.add(questId);
        for (const requirement of quest.taskRequirements) {
            includeWithPrerequisites(requirement.task.id);
        }
    }

    for (const questId of referencedQuestIds) includeWithPrerequisites(questId);
    return quests.filter((quest) => includedIds.has(quest.id));
}

export async function getItemRelationsData(
    itemId: string,
    mode: TarkovDataMode,
    repository?: TarkovDataRepository,
): Promise<ItemRelationsPayload> {
    const dataRepository = repository ?? (await getDefaultRepository());
    const [pricesResult, stationsResult, questsResult] = await Promise.allSettled([
        dataRepository.prices.getCurrent(mode, [itemId]),
        dataRepository.hideout.getStations(mode),
        dataRepository.quests.getAll(mode),
    ]);

    const preparedQuests =
        questsResult.status === "fulfilled"
            ? orderQuestsByPrerequisites(
                  excludeRemovedQuests(
                      prepareQuestDataForMode(questsResult.value.data, mode),
                  ),
              )
            : [];
    const questItemIndex = buildQuestItemIndex(preparedQuests).filter(
        (entry) => entry.itemId === itemId,
    );
    const questRewardIndex = buildQuestRewardIndex(preparedQuests).filter(
        (entry) => entry.itemId === itemId,
    );
    const questAnyOfGroups = buildQuestAnyOfGroups(preparedQuests).filter((group) =>
        group.itemIds.includes(itemId),
    );
    const referencedQuestIds = dedupeIds([
        ...questItemIndex.flatMap((entry) => entry.quests.map((quest) => quest.questId)),
        ...questRewardIndex.flatMap((entry) =>
            entry.quests.map((quest) => quest.questId),
        ),
        ...questAnyOfGroups.map((group) => group.questId),
    ]);
    const relatedItemIds = dedupeIds([
        itemId,
        ...questAnyOfGroups.flatMap((group) => group.itemIds),
    ]);
    const itemsResult = await Promise.allSettled([
        dataRepository.items.getByIds(mode, relatedItemIds),
    ]).then(([result]) => result);
    const itemRecords = itemsResult.status === "fulfilled" ? itemsResult.value.data : {};
    const selectedItem = itemRecords[itemId] ?? null;
    const priceRecords = pricesResult.status === "fulfilled" ? pricesResult.value.data : {};
    const item = selectedItem
        ? { ...selectedItem, marketPrice: priceRecords[itemId] ?? null }
        : null;
    const relatedItems = relatedItemIds.flatMap((relatedItemId) => {
        const relatedItem = itemRecords[relatedItemId];
        if (!relatedItem) return [];
        return [relatedItemId === itemId && item ? item : relatedItem];
    });

    return {
        item,
        relatedItems,
        unresolvedItemIds: relatedItemIds.filter(
            (relatedItemId) => !itemRecords[relatedItemId],
        ),
        hideoutRequirements:
            stationsResult.status === "fulfilled"
                ? getHideoutRequirements(itemId, stationsResult.value.data)
                : [],
        questItemIndex,
        questRewardIndex,
        questAnyOfGroups,
        questAvailabilityQuests: getAvailabilityClosure(
            preparedQuests,
            referencedQuestIds,
        ).map(toQuestAvailabilityQuest),
        freshness: {
            itemsUpdatedAt:
                itemsResult.status === "fulfilled" ? itemsResult.value.updatedAt : null,
            pricesUpdatedAt:
                pricesResult.status === "fulfilled" ? pricesResult.value.updatedAt : null,
            stationsUpdatedAt:
                stationsResult.status === "fulfilled"
                    ? stationsResult.value.updatedAt
                    : null,
            questsUpdatedAt:
                questsResult.status === "fulfilled" ? questsResult.value.updatedAt : null,
        },
        errors: {
            items:
                itemsResult.status === "rejected"
                    ? "Item summaries could not be loaded."
                    : null,
            prices:
                pricesResult.status === "rejected"
                    ? "Item price data could not be loaded."
                    : null,
            stations:
                stationsResult.status === "rejected"
                    ? "Hideout relation data could not be loaded."
                    : null,
            quests:
                questsResult.status === "rejected"
                    ? "Quest relation data could not be loaded."
                    : null,
        },
    };
}
