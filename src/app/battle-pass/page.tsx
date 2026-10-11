import type { Metadata } from "next";
import { BattlePassPage } from "@/features/battle-pass/BattlePassPage";
import { pages } from "@/features/battle-pass/lib/battle-pass-model";
import { parseBattlePassPage } from "@/features/battle-pass/lib/battle-pass-page-link";

export const metadata: Metadata = {
	title: "Battle Pass",
	description: "Plan Season 1 battle pass rewards, track documents and find the cheapest path to your goals.",
	alternates: { canonical: "/battle-pass" },
};

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
	const { page } = await searchParams;
	const initialPage = parseBattlePassPage(page, pages.length);
	return <BattlePassPage key={initialPage ?? "default"} initialPage={initialPage} />;
}
