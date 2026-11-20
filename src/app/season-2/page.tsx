import type { Metadata } from "next";
import { SeasonTwoTeaser } from "@/features/seasons/SeasonTwoTeaser";

export const metadata: Metadata = {
	title: "Season 2 UNTAR Control",
	description: "Season 2 of Escape from Tarkov: UNTAR Control. What is known so far.",
	alternates: { canonical: "/season-2" },
};

export default function Page() {
	return (
		<main className="container mx-auto px-4 py-6 sm:px-6">
			<SeasonTwoTeaser />
		</main>
	);
}
