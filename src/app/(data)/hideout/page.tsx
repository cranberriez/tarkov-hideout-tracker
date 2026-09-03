import { HideoutClientPage } from "@/features/hideout/HideoutClientPage";
import { getActiveTarkovJsonGameMode } from "@/server/active-game-mode";
import { getHideoutPageData } from "@/server/queries/getHideoutPageData";

export const revalidate = false; // Frozen during the Tarkov 1.1 transition

export default async function HideoutPage() {
    const gameMode = await getActiveTarkovJsonGameMode();
    const data = await getHideoutPageData(gameMode);

    return <HideoutClientPage data={data} />;
}
