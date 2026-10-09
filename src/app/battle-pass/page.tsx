import type { Metadata } from "next";
import { BattlePassPage } from "@/features/battle-pass/BattlePassPage";

export const metadata: Metadata = {
	title: "Battle Pass",
	description: "Plan Season 1 battle pass rewards, track documents and find the cheapest path to your goals.",
	alternates: { canonical: "/battle-pass" },
};

export default function Page() {
	return <BattlePassPage />;
}
