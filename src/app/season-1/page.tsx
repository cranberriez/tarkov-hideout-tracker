import type { Metadata } from "next";
import { MostPicked, SeasonModifiers } from "@/features/seasons/SeasonModifiers";
import { SeasonOneHero } from "@/features/seasons/SeasonOneHero";
import { SeasonPageNav } from "@/features/seasons/SeasonPageNav";

export const metadata: Metadata = {
	title: "Season 1 KORD Breach",
	description:
		"Escape from Tarkov Season 1, KORD Breach: every global, positive and negative modifier and the most picked ones.",
	alternates: { canonical: "/season-1" },
};

export default function Page() {
	return (
		<main className="season-page container mx-auto space-y-8 px-4 py-6 sm:px-6">
			<SeasonPageNav current="season-1" />
			<SeasonOneHero />
			<MostPicked seasonId="season-1" title="Most picked" />
			<SeasonModifiers seasonId="season-1" />
		</main>
	);
}
