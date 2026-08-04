import { Suspense } from "react";
import { orderQuestsByPrerequisites } from "@/server/services/quests";
import { getCachedFullQuestData } from "@/server/services/tarkovData";
import { buildQuestAnyOfGroups, buildQuestItemIndex } from "@/lib/utils/quest-item-index";
import { toQuestAvailabilityQuest } from "@/lib/utils/quest-availability";
import { QuestsClientPage } from "@/features/quests/QuestsClientPage";

export const revalidate = false; // Frozen during the Tarkov 1.1 transition

export default async function QuestsPage() {
    const questsResponse = await getCachedFullQuestData();
    const quests = orderQuestsByPrerequisites(questsResponse.data.quests);
    const questItemIndex = buildQuestItemIndex(quests);
    const questAnyOfGroups = buildQuestAnyOfGroups(quests);
    const questAvailabilityQuests = quests.map(toQuestAvailabilityQuest);

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
