import { getCachedQuestData, orderQuestsByPrerequisites } from "@/server/services/quests";
import { buildQuestItemIndex } from "@/lib/utils/quest-item-index";
import { ItemsClientPage } from "@/features/items/ItemsClientPage";

export const revalidate = 43200;

export default async function ItemsPage() {
    const questsResponse = await getCachedQuestData();
    const orderedQuests = orderQuestsByPrerequisites(questsResponse.data.quests);
    const questItemIndex = buildQuestItemIndex(orderedQuests);

    return <ItemsClientPage questItemIndex={questItemIndex} />;
}
