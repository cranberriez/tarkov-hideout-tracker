import { toQuestAvailabilityQuest } from "../../lib/quests/quest-availability";
import { buildQuestAnyOfGroups, buildQuestItemIndex } from "../../lib/quests/quest-item-index";
import { orderQuestsByPrerequisites } from "../../lib/quests/quest-ordering";
import { prepareQuestDataForMode } from "../../lib/quests/quest-preparation";
import { excludeRemovedQuests } from "../../lib/quests/removed-quests";
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
