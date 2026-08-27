import { orderQuestsByPrerequisites } from "@/server/services/quests";
import { getCachedFullQuestData } from "@/server/services/tarkovData";
import { toQuestAvailabilityQuest } from "@/lib/utils/quest-availability";
import { buildQuestAnyOfGroups, buildQuestItemIndex } from "@/lib/utils/quest-item-index";
import { ItemsClientPage } from "@/features/items/ItemsClientPage";
import { getActiveTarkovJsonGameMode } from "@/server/active-game-mode";

export const revalidate = false; // Frozen during the Tarkov 1.1 transition

export default async function ItemsPage() {
    const gameMode = await getActiveTarkovJsonGameMode();
    const questsResponse = await getCachedFullQuestData(gameMode);
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
