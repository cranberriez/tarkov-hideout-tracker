"use client";

import { type ReactNode, useMemo } from "react";
import Link from "next/link";
import { FileSearch } from "lucide-react";
import {
	findStoryChapter,
	MAJOR_EVIDENCE,
	MAJOR_EVIDENCE_REQUIRED,
	MINOR_EVIDENCE,
	STORY_CHAPTER_REFS,
	STORY_DECISIONS,
	STORY_ENDING_BY_ID,
	STORY_ENDINGS,
} from "@/lib/data/story";
import { useUserStoreHydrated } from "@/lib/query/game-data";
import { useUserStore } from "@/lib/stores/useUserStore";
import { cn } from "@/lib/utils";
import type { StoryChapter } from "@/types/story";
import { buildChapterView, evidenceCounts, reachableEndings } from "./story-model";
import type { StoryProgress } from "./story-progress";
import { useStoryProgress } from "./useStoryProgress";

const ENDING_IDS = STORY_ENDINGS.map((ending) => ending.id);

const TRACKED_FIRST = [
	...STORY_CHAPTER_REFS.filter(({ id }) => findStoryChapter(id)),
	...STORY_CHAPTER_REFS.filter(({ id }) => !findStoryChapter(id)),
];

export function StoryIndexClientPage() {
	const hydrated = useUserStoreHydrated();
	const gameMode = useUserStore((state) => state.gameMode);
	const [progress, update] = useStoryProgress(gameMode);
	const targetEnding = hydrated ? progress.targetEnding : null;
	const evidenceNeeded = targetEnding ? (MAJOR_EVIDENCE_REQUIRED[targetEnding] ?? 0) : 0;
	const reachable = useMemo(
		() => reachableEndings(STORY_DECISIONS, progress.decisions, ENDING_IDS),
		[progress.decisions],
	);

	return (
		<main className="container mx-auto flex-1 px-4 py-6 sm:px-6">
			<div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight text-foreground">STORY CHAPTERS</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						Pick an ending, record your choices, and see what is left for your route.
					</p>
				</div>
				<div role="group" aria-label="Target ending" className="grid grid-cols-4 gap-2 md:w-[26rem]">
					{STORY_ENDINGS.map((ending) => {
						const selected = targetEnding === ending.id;
						return (
							<button
								key={ending.id}
								type="button"
								disabled={!hydrated}
								aria-pressed={selected}
								title={reachable.has(ending.id) ? ending.summary : "Ruled out by your choices"}
								onClick={() =>
									update((current) => ({
										...current,
										targetEnding: current.targetEnding === ending.id ? null : ending.id,
									}))
								}
								className={cn(
									"flex flex-col items-center gap-1 rounded-md border px-2 py-1.5 transition-colors",
									selected
										? "border-brand/60 bg-brand/10"
										: "border-highlight/10 bg-shadow/30 hover:border-brand/30 hover:bg-brand/5",
									hydrated && !reachable.has(ending.id) && "opacity-45",
								)}
							>
								<img src={ending.image} alt="" className="size-9 object-contain" />
								<span className="text-xs font-semibold text-foreground">{ending.name}</span>
							</button>
						);
					})}
				</div>
			</div>
			{targetEnding && (
				<p className="mt-3 text-xs font-semibold text-special md:text-right">
					{STORY_ENDING_BY_ID[targetEnding].name} needs {evidenceNeeded} of {MAJOR_EVIDENCE.length} major evidence
				</p>
			)}
			<ul className="mt-6 grid gap-3 md:grid-cols-2">
				{TRACKED_FIRST.map(({ id, name }) => {
					const chapter = findStoryChapter(id);
					const evidence = evidenceNeeded > 0 ? <ChapterEvidenceNote chapterId={id} /> : null;
					return (
						<li key={id}>
							{chapter ? (
								<TrackedChapterCard chapter={chapter} progress={hydrated ? progress : null} evidence={evidence} />
							) : (
								<Link
									href={`/story/${id}`}
									className="flex h-full items-center justify-between gap-3 rounded-md border border-highlight/8 bg-shadow/20 px-4 py-3 transition-colors hover:border-highlight/20"
								>
									<div>
										<span className="text-sm font-semibold text-muted-foreground">{name}</span>
										{evidence}
									</div>
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

function ChapterEvidenceNote({ chapterId }: { chapterId: string }) {
	const { major, minor } = evidenceCounts(chapterId, MAJOR_EVIDENCE, MINOR_EVIDENCE);
	if (major === 0) return null;
	return (
		<p className="flex items-center gap-1 text-xs font-semibold text-special">
			<FileSearch aria-hidden="true" className="size-3" />
			{major} major evidence
			{minor > 0 && <span className="font-normal text-muted-foreground">· {minor} minor</span>}
		</p>
	);
}

function TrackedChapterCard({
	chapter,
	progress,
	evidence,
}: {
	chapter: StoryChapter;
	progress: StoryProgress | null;
	evidence: ReactNode;
}) {
	const stats = progress ? buildChapterView(chapter, STORY_DECISIONS, progress).stats : null;
	// Only chapters whose route differs by ending show the target ending.
	const branchesByEnding = chapter.sections.some((section) => section.endings);
	const ending = branchesByEnding && progress?.targetEnding ? STORY_ENDING_BY_ID[progress.targetEnding] : null;
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
			<div aria-hidden="true" className="absolute inset-0 bg-linear-to-r from-shadow/70 via-shadow/35 to-transparent" />
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
					{evidence}
				</div>
				{ending && <img src={ending.image} alt={ending.name} title={`Target: ${ending.name}`} className="size-10" />}
			</div>
		</Link>
	);
}
