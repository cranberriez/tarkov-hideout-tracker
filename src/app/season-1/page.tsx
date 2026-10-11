import type { Metadata } from "next";
import { SeasonOverviewPage } from "@/features/season-1/SeasonOverviewPage";

export const metadata: Metadata = {
	title: "Season 1",
	description: "Season 1 KORD Breach overview, battle pass goals and document coverage.",
	alternates: { canonical: "/season-1" },
};

export default function Page() {
	return <SeasonOverviewPage />;
}
