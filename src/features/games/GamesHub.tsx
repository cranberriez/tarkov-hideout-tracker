"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpDown, Fingerprint, PackageSearch, Trophy, type LucideIcon } from "lucide-react";
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
		description: "Ask for quest objective, barter and trade clues, then name the trader in five questions or fewer.",
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
			className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-brand hover:shadow-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none"
		>
			<game.Icon
				size={160}
				strokeWidth={1}
				aria-hidden
				className="pointer-events-none absolute -right-8 -top-8 text-brand opacity-[0.06] transition-transform duration-500 group-hover:rotate-6 group-hover:scale-110 motion-reduce:transition-none"
			/>
			<span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand ring-1 ring-brand/20 transition-colors group-hover:bg-brand group-hover:text-inverse">
				<game.Icon size={28} />
			</span>
			<span className="flex flex-col gap-1">
				<span className="text-lg font-bold text-foreground group-hover:text-brand">{game.title}</span>
				<span className="text-sm text-muted-foreground">{game.description}</span>
			</span>
			<span className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-4">
				<span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-subtle-foreground">
					<Trophy size={14} />
					{game.bestLabel} <span className="tabular-nums text-foreground">{best}</span>
				</span>
				<span className="flex items-center gap-1 text-sm font-semibold text-brand">
					Play
					<ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
				</span>
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
