import { orderQuestsByPrerequisites } from "@/server/services/quests";
import { getCachedFullQuestData } from "@/server/services/tarkovData";
import { toQuestAvailabilityQuest } from "@/lib/utils/quest-availability";
import { buildQuestAnyOfGroups, buildQuestItemIndex, buildQuestRewardIndex } from "@/lib/utils/quest-item-index";
import { ItemsClientPage } from "@/features/items/ItemsClientPage";
import { getActiveTarkovJsonGameMode } from "@/server/active-game-mode";
import { excludeRemovedQuests } from "@/lib/utils/removed-quests";
import { applyQuestFactionOverrides } from "@/lib/utils/quest-faction-overrides";
import { prepareQuestSeriesForGameMode } from "@/lib/utils/quest-series";

export const revalidate = false; // Frozen during the Tarkov 1.1 transition

export default async function ItemsPage() {
    const gameMode = await getActiveTarkovJsonGameMode();
    const questsResponse = await getCachedFullQuestData(gameMode);
    const normalizedQuests = prepareQuestSeriesForGameMode(
        applyQuestFactionOverrides(questsResponse.data.quests),
        gameMode,
    );
    const orderedQuests = orderQuestsByPrerequisites(
        excludeRemovedQuests(normalizedQuests),
    );
    const questItemIndex = buildQuestItemIndex(orderedQuests);
    const questRewardIndex = buildQuestRewardIndex(orderedQuests);
    const questAnyOfGroups = buildQuestAnyOfGroups(orderedQuests);
    const questAvailabilityQuests = orderedQuests.map(toQuestAvailabilityQuest);

    return (
        <ItemsClientPage
            questItemIndex={questItemIndex}
            questRewardIndex={questRewardIndex}
            questAnyOfGroups={questAnyOfGroups}
            questAvailabilityQuests={questAvailabilityQuests}
        />
    );
}
