import { getCachedQuestData } from "@/server/services/quests";
import { poolQuestItems } from "@/lib/utils/quest-pooling";
import { ItemsClientPage } from "@/features/items/ItemsClientPage";

export const revalidate = 43200;

export default async function ItemsPage() {
    const questsResponse = await getCachedQuestData();
    const questPoolItems = poolQuestItems(questsResponse.data.quests);

    return <ItemsClientPage questPoolItems={questPoolItems} />;
}
