import { getActiveTarkovJsonGameMode } from "@/server/active-game-mode";
import { getProfitPageData } from "@/server/services/profitPages";
import { ProfitPageClient } from "./ProfitPageClient";
import type { ProfitPageKind } from "./types";

export async function ProfitPage({
  kind,
  searchParams,
}: {
  kind: ProfitPageKind;
  searchParams: Promise<{ recipe?: string }>;
}) {
  const [{ recipe }, mode] = await Promise.all([
    searchParams,
    getActiveTarkovJsonGameMode(),
  ]);
  const data = await getProfitPageData(mode);
  return (
    <ProfitPageClient kind={kind} data={data} initialTargetRecipeId={recipe} />
  );
}
