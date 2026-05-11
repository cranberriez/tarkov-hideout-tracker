import { getCachedQuestData, orderQuestsByPrerequisites } from "@/server/services/quests";
import { getCachedTraders } from "@/server/services/traders";
import { QuestsClientPage } from "@/features/quests/QuestsClientPage";

export const revalidate = 43200;

export default async function QuestsPage() {
    const [questsResponse, tradersResponse] = await Promise.all([
        getCachedQuestData(),
        getCachedTraders(),
    ]);

    const quests = orderQuestsByPrerequisites(questsResponse.data.quests);

    return (
        <QuestsClientPage
            quests={quests}
            traders={tradersResponse.data.traders}
            updatedAt={questsResponse.updatedAt}
        />
    );
}
