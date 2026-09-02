import { getActiveTarkovJsonGameMode } from "@/server/active-game-mode";
import { getProfitPageData } from "@/server/services/profitPages";
import { ProfitPageClient } from "@/features/profit-pages/ProfitPageClient";

export default async function CraftingProfitsPage({
    searchParams,
}: {
    searchParams: Promise<{ recipe?: string }>;
}) {
    const { recipe } = await searchParams;
    const mode = await getActiveTarkovJsonGameMode();
    const data = await getProfitPageData(mode);
    return <ProfitPageClient kind="craft" data={data} initialTargetRecipeId={recipe} />;
}
