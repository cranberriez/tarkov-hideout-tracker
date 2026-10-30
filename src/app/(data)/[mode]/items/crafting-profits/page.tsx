import { ProfitPage } from "@/features/profit-pages/ProfitPage";
import type { ModeRouteParams } from "@/server/route-game-mode";

export default async function CraftingProfitsPage({ params }: { params: ModeRouteParams }) {
	return <ProfitPage kind="craft" params={params} />;
}
