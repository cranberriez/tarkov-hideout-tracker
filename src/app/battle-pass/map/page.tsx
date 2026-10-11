import type { Metadata } from "next";
import { BattlePassMapPage } from "@/features/battle-pass/BattlePassMapPage";

export const metadata: Metadata = {
	title: "Battle Pass Document Map",
	description: "Find Season 1 battle pass document spawn locations on interactive maps.",
	alternates: { canonical: "/battle-pass/map" },
};

export default function Page() {
	return <BattlePassMapPage />;
}
