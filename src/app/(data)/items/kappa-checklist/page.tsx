import { orderQuestsByPrerequisites } from "@/server/services/quests";
import { getCachedFullQuestData } from "@/server/services/tarkovData";
import { getActiveTarkovJsonGameMode } from "@/server/active-game-mode";
import { applyQuestFactionOverrides } from "@/lib/utils/quest-faction-overrides";
import { excludeRemovedQuests } from "@/lib/utils/removed-quests";
import { prepareQuestSeriesForGameMode } from "@/lib/utils/quest-series";
import { toQuestAvailabilityQuest } from "@/lib/utils/quest-availability";
import {
    buildQuestAnyOfGroups,
    buildQuestItemIndex,
    buildQuestRewardIndex,
} from "@/lib/utils/quest-item-index";
import { KappaChecklistClientPage } from "@/features/items/kappa/KappaChecklistClientPage";
import {
    findCollectorQuest,
    getCollectorRequiredItemIds,
} from "@/features/items/kappa/kappa-items";

export const revalidate = false; // Frozen during the Tarkov 1.1 transition

export default async function KappaChecklistPage() {
    const gameMode = await getActiveTarkovJsonGameMode();
    const questsResponse = await getCachedFullQuestData(gameMode);
    const normalizedQuests = prepareQuestSeriesForGameMode(
        applyQuestFactionOverrides(questsResponse.data.quests),
        gameMode,
    );
    const orderedQuests = orderQuestsByPrerequisites(
        excludeRemovedQuests(normalizedQuests),
    );
    const collectorQuest = findCollectorQuest(orderedQuests);

    return (
        <KappaChecklistClientPage
            collectorQuest={
                collectorQuest
                    ? {
                          id: collectorQuest.id,
                          name: collectorQuest.name,
                          traderImageLink: collectorQuest.trader.imageLink,
                          traderImage4xLink: collectorQuest.trader.image4xLink,
                      }
                    : null
            }
            collectorItemIds={getCollectorRequiredItemIds(orderedQuests)}
            questItemIndex={buildQuestItemIndex(orderedQuests)}
            questRewardIndex={buildQuestRewardIndex(orderedQuests)}
            questAnyOfGroups={buildQuestAnyOfGroups(orderedQuests)}
            questAvailabilityQuests={orderedQuests.map(toQuestAvailabilityQuest)}
        />
    );
}
