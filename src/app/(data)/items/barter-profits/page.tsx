import { ProfitPage } from "@/features/profit-pages/ProfitPage";

export default async function BarterProfitsPage({
  searchParams,
}: {
  searchParams: Promise<{ recipe?: string }>;
}) {
  return <ProfitPage kind="barter" searchParams={searchParams} />;
}
