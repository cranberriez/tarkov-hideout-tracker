import { BattlePassSeason } from "@/features/battle-pass/BattlePassSeason";
import { getBattlePassData } from "@/lib/battle-pass-seasons";
import type { Metadata } from "next";
import { BattlePassPage } from "@/features/battle-pass/BattlePassPage";
import { pages } from "@/features/battle-pass/lib/battle-pass-model";
import { parseBattlePassPage } from "@/features/battle-pass/lib/battle-pass-page-link";

export const metadata: Metadata = {
	title: "Battle Pass",
	description: "Plan seasonal battle pass rewards, track documents and find the cheapest path to your goals.",
	alternates: { canonical: "/battle-pass" },
};

export default async function Page({
	searchParams,
}: {
	searchParams: Promise<{ page?: string | string[]; season?: string | string[] }>;
}) {
	const { page, season } = await searchParams;
	const seasonId = season === "season-1" || season === "season-2" ? season : undefined;
	const initialPage = parseBattlePassPage(page, seasonId ? getBattlePassData(seasonId).pages.length : pages.length);
	return (
		<BattlePassSeason seasonId={seasonId}>
			<BattlePassPage key={initialPage ?? "default"} initialPage={initialPage} />
		</BattlePassSeason>
	);
}
