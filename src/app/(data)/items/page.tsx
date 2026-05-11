import { getCachedQuestData } from "@/server/services/quests";
import { poolQuestItemsPerQuest } from "@/lib/utils/quest-pooling";
import { ItemsClientPage } from "@/features/items/ItemsClientPage";

export const revalidate = 43200;

export default async function ItemsPage() {
    const questsResponse = await getCachedQuestData();
    const perQuestPools = poolQuestItemsPerQuest(questsResponse.data.quests);

    return <ItemsClientPage perQuestPools={perQuestPools} />;
}
