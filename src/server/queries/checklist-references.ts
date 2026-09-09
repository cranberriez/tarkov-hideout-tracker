import { toQuestAvailabilityQuest } from "../../lib/utils/quest-availability";
import { buildQuestAnyOfGroups, buildQuestItemIndex } from "../../lib/utils/quest-item-index";
import { orderQuestsByPrerequisites } from "../../lib/utils/quest-ordering";
import { prepareQuestDataForMode } from "../../lib/utils/quest-preparation";
import { excludeRemovedQuests } from "../../lib/utils/removed-quests";
import type { TarkovDataMode } from "../../types/common";
import type { Station } from "../../types/hideout";
import type { FullQuest } from "../../types/quests";
import { dedupeIds, getStationItemIds } from "./query-utils";

// Shared by the checklist payload and its named price scope. Neither loads item records.
export function buildChecklistReferences(mode: TarkovDataMode, stations: Station[], rawQuests: FullQuest[]) {
    const quests = orderQuestsByPrerequisites(excludeRemovedQuests(prepareQuestDataForMode(rawQuests, mode)));
    const questItemIndex = buildQuestItemIndex(quests);
    const questAnyOfGroups = buildQuestAnyOfGroups(quests);
    return {
        questItemIndex,
        questAnyOfGroups,
        questAvailabilityQuests: quests.map(toQuestAvailabilityQuest),
        itemIds: dedupeIds([
            ...getStationItemIds(stations),
            ...questItemIndex.map((entry) => entry.itemId),
            ...questAnyOfGroups.flatMap((group) => group.itemIds),
        ]),
    };
}
