import { DeferredPriceBoundary } from "@/features/items/DeferredPriceBoundary";
import { getDeferredPriceScope } from "@/server/queries/getDeferredPrices";
import { getActiveTarkovJsonGameMode } from "@/server/active-game-mode";
import { KappaChecklistClientPage } from "@/features/items/kappa/KappaChecklistClientPage";
import { getKappaChecklistPageData } from "@/server/queries/getKappaChecklistPageData";

export const revalidate = false; // Frozen during the Tarkov 1.1 transition

export default async function KappaChecklistPage() {
    const gameMode = await getActiveTarkovJsonGameMode();
    const pageData = await getKappaChecklistPageData(gameMode, undefined, { includePrices: false });

    return (
        <DeferredPriceBoundary {...getDeferredPriceScope(gameMode)} itemIds={pageData.items.map((item) => item.id)}>
        <KappaChecklistClientPage
            collectorQuest={pageData.collectorQuest}
            collectorItems={pageData.items}
            unresolvedItemIds={pageData.unresolvedItemIds}
            errors={pageData.errors}
        />
        </DeferredPriceBoundary>
    );
}
