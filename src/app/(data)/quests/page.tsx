import { getCachedFullQuestData, orderQuestsByPrerequisites } from "@/server/services/quests";
import { QuestsClientPage } from "@/features/quests/QuestsClientPage";

export const revalidate = 43200;

export default async function QuestsPage() {
    const questsResponse = await getCachedFullQuestData();
    const quests = orderQuestsByPrerequisites(questsResponse.data.quests);

    return <QuestsClientPage quests={quests} updatedAt={questsResponse.updatedAt} />;
}
