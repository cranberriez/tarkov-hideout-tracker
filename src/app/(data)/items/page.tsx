import { orderQuestsByPrerequisites } from "@/server/services/quests";
import { getCachedFullQuestData } from "@/server/services/tarkovData";
import { toQuestAvailabilityQuest } from "@/lib/utils/quest-availability";
import { buildQuestAnyOfGroups, buildQuestItemIndex } from "@/lib/utils/quest-item-index";
import { ItemsClientPage } from "@/features/items/ItemsClientPage";

export const revalidate = 1209600; // 14 days; tag revalidation handles freshness

export default async function ItemsPage() {
    const questsResponse = await getCachedFullQuestData();
    const orderedQuests = orderQuestsByPrerequisites(questsResponse.data.quests);
    const questItemIndex = buildQuestItemIndex(orderedQuests);
    const questAnyOfGroups = buildQuestAnyOfGroups(orderedQuests);
    const questAvailabilityQuests = orderedQuests.map(toQuestAvailabilityQuest);

    return (
        <ItemsClientPage
            questItemIndex={questItemIndex}
            questAnyOfGroups={questAnyOfGroups}
            questAvailabilityQuests={questAvailabilityQuests}
        />
    );
}
