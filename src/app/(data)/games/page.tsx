import type { Metadata } from "next";
import { GamesHub } from "@/features/games/GamesHub";

export const metadata: Metadata = {
	title: "Games",
	description: "Escape from Tarkov mini-games: Higher or Lower, Do I Need It? and Trader Alibi.",
	alternates: { canonical: "/games" },
};

export default function GamesPage() {
	return <GamesHub />;
}
