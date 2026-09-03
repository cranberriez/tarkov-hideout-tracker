import { toQuestAvailabilityQuest } from "../../lib/utils/quest-availability";
import {
    buildQuestAnyOfGroups,
    buildQuestItemIndex,
    buildQuestRewardIndex,
} from "../../lib/utils/quest-item-index";
import { orderQuestsByPrerequisites } from "../../lib/utils/quest-ordering";
import { prepareQuestDataForMode } from "../../lib/utils/quest-preparation";
import {
    excludeRemovedQuests,
    prepareQuestsForDisplay,
} from "../../lib/utils/removed-quests";
import type { TarkovDataRepository } from "@/server/repositories/tarkov-data/types";
import type { TarkovDataMode } from "@/types/common";
import type { QuestWorkspacePageData } from "@/types/contracts";
import type { FullQuest } from "@/types/quests";
import {
    getDefaultRepository,
    getQuestReferencedItemIds,
    mergePricedItems,
} from "./query-utils";

export interface QuestWorkspaceQueryOptions {
    showRemovedQuests?: boolean;
    displayQuestAdditions?: readonly FullQuest[];
}

export async function getQuestWorkspacePageData(
    mode: TarkovDataMode,
    repository?: TarkovDataRepository,
    options: QuestWorkspaceQueryOptions = {},
): Promise<QuestWorkspacePageData> {
    const dataRepository = repository ?? (await getDefaultRepository());
    const questsResult = await Promise.allSettled([
        dataRepository.quests.getAll(mode),
    ]).then(([result]) => result);

    if (questsResult.status === "rejected") {
        return {
            quests: null,
            items: null,
            itemIds: [],
            unresolvedItemIds: [],
            questItemIndex: [],
            questRewardIndex: [],
            questAnyOfGroups: [],
            questAvailabilityQuests: [],
            freshness: {
                questsUpdatedAt: null,
                itemsUpdatedAt: null,
                pricesUpdatedAt: null,
            },
            errors: {
                quests: "Quest workspace data could not be loaded.",
                items: "Quest item data could not be loaded without quests.",
                prices: "Quest price data could not be loaded without quests.",
            },
        };
    }

    const preparedQuests = prepareQuestDataForMode(questsResult.value.data, mode);
    const progressionQuests = orderQuestsByPrerequisites(
        excludeRemovedQuests(preparedQuests),
    );
    const displayQuests = orderQuestsByPrerequisites([
        ...prepareQuestsForDisplay(
            preparedQuests,
            options.showRemovedQuests ?? false,
        ),
        ...(options.displayQuestAdditions ?? []),
    ]);
    const questItemIndex = buildQuestItemIndex(progressionQuests);
    const questRewardIndex = buildQuestRewardIndex(progressionQuests);
    const questAnyOfGroups = buildQuestAnyOfGroups(progressionQuests);
    const questAvailabilityQuests = progressionQuests.map(toQuestAvailabilityQuest);
    const itemIds = getQuestReferencedItemIds(displayQuests);
    const [itemsResult, pricesResult] = await Promise.allSettled([
        dataRepository.items.getByIds(mode, itemIds),
        dataRepository.prices.getCurrent(mode, itemIds),
    ]);
    const itemRecords = itemsResult.status === "fulfilled" ? itemsResult.value.data : null;
    const priceRecords = pricesResult.status === "fulfilled" ? pricesResult.value.data : {};
    const merged = itemRecords
        ? mergePricedItems(itemIds, itemRecords, priceRecords)
        : { items: null, unresolvedItemIds: [...itemIds] };

    return {
        quests: displayQuests,
        items: merged.items,
        itemIds,
        unresolvedItemIds: merged.unresolvedItemIds,
        questItemIndex,
        questRewardIndex,
        questAnyOfGroups,
        questAvailabilityQuests,
        freshness: {
            questsUpdatedAt: questsResult.value.updatedAt,
            itemsUpdatedAt:
                itemsResult.status === "fulfilled" ? itemsResult.value.updatedAt : null,
            pricesUpdatedAt:
                pricesResult.status === "fulfilled" ? pricesResult.value.updatedAt : null,
        },
        errors: {
            quests: null,
            items:
                itemsResult.status === "rejected"
                    ? "Quest item summaries could not be loaded."
                    : null,
            prices:
                pricesResult.status === "rejected"
                    ? "Quest item prices could not be loaded."
                    : null,
        },
    };
}
