"use client";

import Link from "next/link";
import { ArrowUpDown, Fingerprint, PackageSearch, type LucideIcon } from "lucide-react";
import { useStoredProfitValue } from "@/features/profit-pages/useStoredProfitValue";
import { parseBestScore } from "./useBestScore";
import { parseBestStreak } from "./higher-lower/higher-lower-model";
import { HIGHER_LOWER_STORAGE_KEY } from "./higher-lower/useHigherLowerGame";
import { DO_I_NEED_IT_STORAGE_KEY } from "./do-i-need-it/useDoINeedItGame";
import { TRADER_ALIBI_STORAGE_KEY } from "./trader-alibi/useTraderAlibiGame";

interface GameCard {
	href: string;
	title: string;
	description: string;
	Icon: LucideIcon;
	storageKey: string;
	parse: (raw: string | null) => number;
	bestLabel: string;
}

const GAMES: GameCard[] = [
	{
		href: "/games/higher-lower",
		title: "Higher or Lower",
		description: "Is the next item worth more or less? Build a streak as the gaps get tighter.",
		Icon: ArrowUpDown,
		storageKey: HIGHER_LOWER_STORAGE_KEY,
		parse: parseBestStreak,
		bestLabel: "Best streak",
	},
	{
		href: "/games/do-i-need-it",
		title: "Do I Need It?",
		description: "Spot the items your quests and hideout still need among look-alike decoys.",
		Icon: PackageSearch,
		storageKey: DO_I_NEED_IT_STORAGE_KEY,
		parse: parseBestScore,
		bestLabel: "Best streak",
	},
	{
		href: "/games/trader-alibi",
		title: "Trader Alibi",
		description: "Ask for quest, barter and trade clues, then name the trader in five questions or fewer.",
		Icon: Fingerprint,
		storageKey: TRADER_ALIBI_STORAGE_KEY,
		parse: parseBestScore,
		bestLabel: "Best score",
	},
];

function GameLink({ game }: { game: GameCard }) {
	const [raw] = useStoredProfitValue(game.storageKey);
	const best = game.parse(raw);
	return (
		<Link
			href={game.href}
			className="group flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
		>
			<span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
				<game.Icon size={26} />
			</span>
			<span className="flex flex-col gap-1">
				<span className="text-lg font-bold text-foreground group-hover:text-brand">{game.title}</span>
				<span className="text-sm text-muted-foreground">{game.description}</span>
			</span>
			<span className="mt-auto text-xs font-semibold uppercase tracking-wide text-subtle-foreground">
				{game.bestLabel}: <span className="tabular-nums text-foreground">{best}</span>
			</span>
		</Link>
	);
}

/** Lists the games with each one's saved best score. */
export function GamesHub() {
	return (
		<main className="container mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 md:py-12">
			<header>
				<h1 className="text-3xl font-bold text-foreground">Games</h1>
				<p className="mt-1 text-muted-foreground">Quick games built on the same item, quest and trader data as the tracker.</p>
			</header>
			<div className="grid gap-4 md:grid-cols-3">
				{GAMES.map((game) => (
					<GameLink key={game.href} game={game} />
				))}
			</div>
		</main>
	);
}
