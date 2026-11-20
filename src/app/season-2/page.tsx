import type { Metadata } from "next";
import { MostPicked, SeasonModifiers } from "@/features/seasons/SeasonModifiers";
import { SeasonChangesProvider } from "@/features/seasons/SeasonChanges";
import { SeasonPageNav } from "@/features/seasons/SeasonPageNav";
import { SeasonTwoTeaser } from "@/features/seasons/SeasonTwoTeaser";

export const metadata: Metadata = {
	title: "Season 2 UNTAR Control",
	description:
		"Escape from Tarkov Season 2, UNTAR Control: announcement and every global, positive and negative modifier.",
	alternates: { canonical: "/season-2" },
};

export default function Page() {
	return (
		<main className="season-page container mx-auto space-y-8 px-4 py-6 sm:px-6">
			<SeasonPageNav current="season-2" />
			<SeasonChangesProvider>
				<SeasonTwoTeaser />
				<SeasonModifiers seasonId="season-2" />
			</SeasonChangesProvider>
			<MostPicked seasonId="season-1" title="Most picked in Season 1" />
		</main>
	);
}
