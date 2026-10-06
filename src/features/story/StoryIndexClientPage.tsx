"use client";

import Link from "next/link";
import { findStoryChapter, STORY_CHAPTER_REFS, STORY_DECISIONS, STORY_ENDING_BY_ID } from "@/lib/data/story";
import { useUserStoreHydrated } from "@/lib/query/game-data";
import { useUserStore } from "@/lib/stores/useUserStore";
import type { StoryChapter } from "@/types/story";
import { buildChapterView } from "./story-model";
import type { StoryProgress } from "./story-progress";
import { useStoryProgress } from "./useStoryProgress";

const TRACKED_FIRST = [
	...STORY_CHAPTER_REFS.filter(({ id }) => findStoryChapter(id)),
	...STORY_CHAPTER_REFS.filter(({ id }) => !findStoryChapter(id)),
];

export function StoryIndexClientPage() {
	const hydrated = useUserStoreHydrated();
	const gameMode = useUserStore((state) => state.gameMode);
	const [progress] = useStoryProgress(gameMode);

	return (
		<main className="container mx-auto flex-1 px-4 py-6 sm:px-6">
			<h1 className="text-3xl font-bold tracking-tight text-foreground">STORY CHAPTERS</h1>
			<p className="mt-1 text-sm text-muted-foreground">
				Pick an ending, record your choices, and see what is left for your route.
			</p>
			<ul className="mt-6 grid gap-3 md:grid-cols-2">
				{TRACKED_FIRST.map(({ id, name }) => {
					const chapter = findStoryChapter(id);
					return (
						<li key={id}>
							{chapter ? (
								<TrackedChapterCard chapter={chapter} progress={hydrated ? progress : null} />
							) : (
								<Link
									href={`/story/${id}`}
									className="flex h-full items-center justify-between rounded-md border border-highlight/8 bg-shadow/20 px-4 py-3 transition-colors hover:border-highlight/20"
								>
									<span className="text-sm font-semibold text-muted-foreground">{name}</span>
									<span className="text-xs text-subtle-foreground">Not tracked yet</span>
								</Link>
							)}
						</li>
					);
				})}
			</ul>
		</main>
	);
}

function TrackedChapterCard({ chapter, progress }: { chapter: StoryChapter; progress: StoryProgress | null }) {
	const stats = progress ? buildChapterView(chapter, STORY_DECISIONS, progress).stats : null;
	const ending = progress?.targetEnding ? STORY_ENDING_BY_ID[progress.targetEnding] : null;
	return (
		<Link
			href={`/story/${chapter.id}`}
			className="group relative flex h-full min-h-24 overflow-hidden rounded-md border border-highlight/10 bg-shadow/40 transition-colors hover:border-brand/40"
		>
			<img
				src={chapter.banner}
				alt=""
				className="absolute inset-0 h-full w-full object-cover opacity-35 transition-opacity group-hover:opacity-50"
			/>
			<div className="relative flex flex-1 items-center gap-3 p-4">
				<img src={chapter.icon} alt="" className="h-9 w-auto" />
				<div className="min-w-0 flex-1">
					<h2 className="text-lg font-semibold text-foreground">{chapter.name}</h2>
					{stats && (
						<p className="text-xs text-muted-foreground">
							{stats.requiredDone} of {stats.requiredTotal} steps done
							{stats.pendingRequired > 0 ? ` · ${stats.pendingRequired} depend on choices` : ""}
						</p>
					)}
				</div>
				{ending && <img src={ending.image} alt={ending.name} title={`Target: ${ending.name}`} className="size-10" />}
			</div>
		</Link>
	);
}
