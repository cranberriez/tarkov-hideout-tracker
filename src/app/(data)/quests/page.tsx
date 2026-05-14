import { getCachedFullQuestData, orderQuestsByPrerequisites } from "@/server/services/quests";
import { buildQuestItemIndex } from "@/lib/utils/quest-item-index";
import { toQuestAvailabilityQuest } from "@/lib/utils/quest-availability";
import { QuestsClientPage } from "@/features/quests/QuestsClientPage";

export const revalidate = 43200;

export default async function QuestsPage() {
    const questsResponse = await getCachedFullQuestData();
    const quests = orderQuestsByPrerequisites(questsResponse.data.quests);
    const questItemIndex = buildQuestItemIndex(quests);
    const questAvailabilityQuests = quests.map(toQuestAvailabilityQuest);

    return (
        <QuestsClientPage
            quests={quests}
            updatedAt={questsResponse.updatedAt}
            questItemIndex={questItemIndex}
            questAvailabilityQuests={questAvailabilityQuests}
        />
    );
}
