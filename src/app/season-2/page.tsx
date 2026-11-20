import type { Metadata } from "next";
import { SeasonTwoModifiers } from "@/features/seasons/SeasonTwoModifiers";
import { SeasonTwoTeaser } from "@/features/seasons/SeasonTwoTeaser";

export const metadata: Metadata = {
	title: "Season 2 UNTAR Control",
	description:
		"Escape from Tarkov Season 2, UNTAR Control: announcement and every global, positive and negative modifier.",
	alternates: { canonical: "/season-2" },
};

export default function Page() {
	return (
		<main className="container mx-auto space-y-8 px-4 py-6 sm:px-6">
			<SeasonTwoTeaser />
			<SeasonTwoModifiers />
		</main>
	);
}
