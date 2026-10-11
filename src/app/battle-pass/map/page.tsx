import { BattlePassSeason } from "@/features/battle-pass/BattlePassSeason";
import type { Metadata } from "next";
import { BattlePassMapPage } from "@/features/battle-pass/BattlePassMapPage";

export const metadata: Metadata = {
	title: "Battle Pass Document Map",
	description: "Find seasonal battle pass document spawn locations on interactive maps.",
	alternates: { canonical: "/battle-pass/map" },
};

export default async function Page({ searchParams }: { searchParams: Promise<{ season?: string | string[] }> }) {
	const { season } = await searchParams;
	const seasonId = season === "season-1" || season === "season-2" ? season : undefined;
	return (
		<BattlePassSeason seasonId={seasonId} showHeader={false}>
			<BattlePassMapPage />
		</BattlePassSeason>
	);
}
