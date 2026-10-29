"use client";

import { Globe, Trophy, UserRound, type LucideIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { BackToGames } from "../BackToGames";
import { useBestScore } from "../useBestScore";
import { DO_I_NEED_IT_ALL_STORAGE_KEY, DO_I_NEED_IT_STORAGE_KEY } from "./useDoINeedItGame";

/** Whose needs the game asks about: the player's remaining progress, or everything quests and the hideout use. */
export type NeedSource = "progress" | "all";

const OPTIONS: Array<{ source: NeedSource; title: string; description: string; Icon: LucideIcon; storageKey: string }> =
	[
		{
			source: "progress",
			title: "Use your progress",
			description: "Only what your remaining quests and hideout upgrades still need, minus what you own.",
			Icon: UserRound,
			storageKey: DO_I_NEED_IT_STORAGE_KEY,
		},
		{
			source: "all",
			title: "Play without your progress",
			description: "Anything a quest or hideout upgrade uses, as if it were a fresh wipe.",
			Icon: Globe,
			storageKey: DO_I_NEED_IT_ALL_STORAGE_KEY,
		},
	];

function SourceOption({
	option,
	current,
	onChoose,
}: {
	option: (typeof OPTIONS)[number];
	current: boolean;
	onChoose: (source: NeedSource) => void;
}) {
	const [best] = useBestScore(option.storageKey);
	return (
		<button
			type="button"
			onClick={() => onChoose(option.source)}
			className={cn(
				"group relative flex flex-col items-start gap-3 rounded-2xl border-2 bg-card p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none",
				current ? "border-brand" : "border-border",
			)}
		>
			{current && (
				<span className="absolute right-4 top-4 rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand">
					Current
				</span>
			)}
			<span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand transition-colors group-hover:bg-brand group-hover:text-inverse">
				<option.Icon size={24} />
			</span>
			<span className="flex flex-col gap-1">
				<span className="text-lg font-bold text-foreground">{option.title}</span>
				<span className="text-sm text-muted-foreground">{option.description}</span>
			</span>
			<span className="mt-auto flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-subtle-foreground">
				<Trophy size={14} />
				Best streak <span className="tabular-nums text-foreground">{best}</span>
			</span>
		</button>
	);
}

function SourceOptions({ current, onChoose }: { current: NeedSource | null; onChoose: (source: NeedSource) => void }) {
	return (
		<div className="grid gap-3 md:grid-cols-2 md:gap-4">
			{OPTIONS.map((option) => (
				<SourceOption key={option.source} option={option} current={option.source === current} onChoose={onChoose} />
			))}
		</div>
	);
}

/** Asked when the game opens, before any run starts. */
export function NeedSourcePage({ onChoose }: { onChoose: (source: NeedSource) => void }) {
	return (
		<main className="flex flex-1 flex-col bg-background">
			<div className="container mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 md:py-8">
				<BackToGames className="-mb-2 self-start" />
				<div className="flex flex-1 flex-col justify-center gap-6 pb-[10vh]">
					<header className="text-center">
						<h1 className="text-2xl font-bold text-foreground md:text-3xl">Do I Need It?</h1>
						<p className="mt-1 text-sm text-muted-foreground">How do you want to play?</p>
					</header>
					<SourceOptions current={null} onChoose={onChoose} />
				</div>
			</div>
		</main>
	);
}

/** Reopened from the game; choosing the current option keeps the run, the other starts a new one. */
export function NeedSourceDialog({
	open,
	current,
	onOpenChange,
	onChoose,
}: {
	open: boolean;
	current: NeedSource;
	onOpenChange: (open: boolean) => void;
	onChoose: (source: NeedSource) => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-2xl">
				<DialogTitle>How do you want to play?</DialogTitle>
				<DialogDescription>Switching starts a new run. Each way keeps its own best streak.</DialogDescription>
				<SourceOptions current={current} onChoose={onChoose} />
			</DialogContent>
		</Dialog>
	);
}
