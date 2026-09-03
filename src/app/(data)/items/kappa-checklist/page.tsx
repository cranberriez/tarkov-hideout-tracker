import { getActiveTarkovJsonGameMode } from "@/server/active-game-mode";
import { KappaChecklistClientPage } from "@/features/items/kappa/KappaChecklistClientPage";
import { getKappaChecklistPageData } from "@/server/queries/getKappaChecklistPageData";

export const revalidate = false; // Frozen during the Tarkov 1.1 transition

export default async function KappaChecklistPage() {
    const gameMode = await getActiveTarkovJsonGameMode();
    const pageData = await getKappaChecklistPageData(gameMode);

    return (
        <KappaChecklistClientPage
            collectorQuest={pageData.collectorQuest}
            collectorItems={pageData.items}
            unresolvedItemIds={pageData.unresolvedItemIds}
            errors={pageData.errors}
        />
    );
}
