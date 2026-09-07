import { getActiveTarkovJsonGameMode } from "@/server/active-game-mode";
import { getProfitPageData } from "@/server/queries/getProfitPageData";
import { CraftPlannerClient } from "@/features/profit-pages/optimize/CraftPlannerClient";

export default async function CraftPlannerPage() {
  const mode = await getActiveTarkovJsonGameMode();
  return <CraftPlannerClient data={await getProfitPageData(mode)} />;
}
