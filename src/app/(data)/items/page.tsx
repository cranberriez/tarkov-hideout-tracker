import { ItemsClientPage } from "@/features/items/ItemsClientPage";
import { getActiveTarkovJsonGameMode } from "@/server/active-game-mode";
import { getItemChecklistPageData } from "@/server/queries/getItemChecklistPageData";

export const revalidate = false; // Frozen during the Tarkov 1.1 transition

export default async function ItemsPage() {
    const gameMode = await getActiveTarkovJsonGameMode();
    const data = await getItemChecklistPageData(gameMode);

    return <ItemsClientPage data={data} />;
}
