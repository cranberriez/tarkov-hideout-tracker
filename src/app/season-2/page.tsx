import { SeasonOverviewPage } from "@/features/season-1/SeasonOverviewPage";
export const metadata = {
	title: "Season 2 Test",
	description: "Test season overview with independent progress and placeholder battle pass data.",
};
export default function Page() {
	return <SeasonOverviewPage seasonId="season-2" />;
}
