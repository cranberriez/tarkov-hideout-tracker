import { ProfitPage } from "@/features/profit-pages/ProfitPage";

export default async function CraftingProfitsPage({
  searchParams,
}: {
  searchParams: Promise<{ recipe?: string }>;
}) {
  return <ProfitPage kind="craft" searchParams={searchParams} />;
}
