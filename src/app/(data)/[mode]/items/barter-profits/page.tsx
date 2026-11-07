import { ProfitPage } from "@/features/profit-pages/ProfitPage";
import type { ModeRouteParams } from "@/server/route-game-mode";

export const revalidate = 3600;

export default async function BarterProfitsPage({ params }: { params: ModeRouteParams }) {
	return <ProfitPage kind="barter" params={params} />;
}
