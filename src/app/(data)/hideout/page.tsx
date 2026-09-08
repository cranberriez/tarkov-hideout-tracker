import { DeferredPriceBoundary } from "@/features/items/DeferredPriceBoundary";
import { getDeferredPriceScope } from "@/server/queries/getDeferredPrices";
import { HideoutClientPage } from "@/features/hideout/HideoutClientPage";
import { getActiveTarkovJsonGameMode } from "@/server/active-game-mode";
import { getHideoutPageData } from "@/server/queries/getHideoutPageData";

export const revalidate = false; // Frozen during the Tarkov 1.1 transition

export default async function HideoutPage() {
	const gameMode = await getActiveTarkovJsonGameMode();
	const data = await getHideoutPageData(gameMode, undefined, { includePrices: false });

	return (
		<DeferredPriceBoundary {...await getDeferredPriceScope(gameMode)} itemIds={data.itemIds}>
			<HideoutClientPage data={data} />
		</DeferredPriceBoundary>
	);
}
