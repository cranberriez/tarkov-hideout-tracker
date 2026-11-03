import { ProfitPage } from "@/features/profit-pages/ProfitPage";
import type { ModeRouteParams } from "@/server/route-game-mode";

export default async function BarterProfitsPage({ params }: { params: ModeRouteParams }) {
	return <ProfitPage kind="barter" params={params} />;
}
