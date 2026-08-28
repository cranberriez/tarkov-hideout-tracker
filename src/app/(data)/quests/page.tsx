import { Suspense } from "react";
import { orderQuestsByPrerequisites } from "@/server/services/quests";
import { getCachedFullQuestData } from "@/server/services/tarkovData";
import { buildQuestAnyOfGroups, buildQuestItemIndex } from "@/lib/utils/quest-item-index";
import { toQuestAvailabilityQuest } from "@/lib/utils/quest-availability";
import { QuestsClientPage } from "@/features/quests/QuestsClientPage";
import { getActiveTarkovJsonGameMode } from "@/server/active-game-mode";
import { SHOW_REMOVED_QUESTS } from "@/features/quests/quest-feature-flags";
import {
    excludeRemovedQuests,
    prepareQuestsForDisplay,
} from "@/lib/utils/removed-quests";
import { applyQuestFactionOverrides } from "@/lib/utils/quest-faction-overrides";

export const revalidate = false; // Frozen during the Tarkov 1.1 transition

export default async function QuestsPage() {
    const gameMode = await getActiveTarkovJsonGameMode();
    const questsResponse = await getCachedFullQuestData(gameMode);
    const normalizedQuests = applyQuestFactionOverrides(questsResponse.data.quests);
    const quests = orderQuestsByPrerequisites(
        prepareQuestsForDisplay(normalizedQuests, SHOW_REMOVED_QUESTS),
    );
    const progressionQuests = orderQuestsByPrerequisites(
        excludeRemovedQuests(normalizedQuests),
    );
    const questItemIndex = buildQuestItemIndex(progressionQuests);
    const questAnyOfGroups = buildQuestAnyOfGroups(progressionQuests);
    const questAvailabilityQuests = progressionQuests.map(toQuestAvailabilityQuest);

    return (
        <Suspense fallback={null}>
            <QuestsClientPage
                quests={quests}
                updatedAt={questsResponse.updatedAt}
                questItemIndex={questItemIndex}
                questAnyOfGroups={questAnyOfGroups}
                questAvailabilityQuests={questAvailabilityQuests}
            />
        </Suspense>
    );
}
