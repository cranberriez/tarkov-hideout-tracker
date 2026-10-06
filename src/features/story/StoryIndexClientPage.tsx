"use client";

import { type ReactNode, useMemo, useState } from "react";
import Link from "next/link";
import { FileSearch, TriangleAlert, X } from "lucide-react";
import {
	findStoryChapter,
	MAJOR_EVIDENCE,
	MAJOR_EVIDENCE_REQUIRED,
	MINOR_EVIDENCE,
	STORY_CHAPTER_REFS,
	STORY_DECISIONS,
	STORY_ENDING_BY_ID,
	STORY_ENDINGS,
	storyChapterLink,
} from "@/lib/data/story";
import { useUserStoreHydrated } from "@/lib/query/game-data";
import { useUserStore } from "@/lib/stores/useUserStore";
import { cn } from "@/lib/utils";
import type { StoryChapter, StoryEndingId } from "@/types/story";
import { buildChapterView, endingBlockers, evidenceCounts, reachableEndings } from "./story-model";
import type { StoryProgress } from "./story-progress";
import { StoryEvidenceRow } from "./components/StoryEvidenceRow";
import { chapterCompletionState } from "./chapter-completion";
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
	const [reason, setReason] = useState<{ ending: StoryEndingId; mode: string; target: StoryEndingId | null } | null>(
		null,
	);
	if (reason && (reason.mode !== gameMode || reason.target !== targetEnding)) setReason(null);
	const evidenceNeeded = targetEnding ? (MAJOR_EVIDENCE_REQUIRED[targetEnding] ?? 0) : 0;
	const blockers = useMemo(() => endingBlockers(STORY_DECISIONS, progress.decisions, ENDING_IDS), [progress.decisions]);
	const reachable = useMemo(
		() => reachableEndings(STORY_DECISIONS, progress.decisions, ENDING_IDS),
		[progress.decisions],
	);

	const visibleBlockers =
		hydrated && reason ? blockers.filter((blocker) => blocker.endings.includes(reason.ending)) : [];

	return (
		<main className="container mx-auto flex-1 px-4 py-6 sm:px-6">
			<div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight text-foreground">STORY CHAPTERS</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						Pick an ending, record your choices, and see what is left for your route.
					</p>
				</div>
				<div role="group" aria-label="Target ending" className="grid grid-cols-4 items-start gap-2 md:w-[26rem]">
					{STORY_ENDINGS.map((ending) => {
						const selected = targetEnding === ending.id;
						const unavailable = hydrated && !reachable.has(ending.id);
						const expanded = reason?.ending === ending.id && visibleBlockers.length > 0;
						return (
							<div key={ending.id} className="isolate flex min-w-0 flex-col">
								<button
									type="button"
									disabled={!hydrated}
									aria-pressed={selected}
									title={reachable.has(ending.id) ? ending.summary : "Ruled out by your choices"}
									onClick={() => {
										setReason(null);
										update((current) => ({
											...current,
											targetEnding: current.targetEnding === ending.id ? null : ending.id,
										}));
									}}
									className={cn(
										"relative z-10 flex w-full flex-col items-center gap-1 rounded-md border bg-background px-2 py-1.5 transition-colors",
										selected ? "border-brand/60" : "border-highlight/10 hover:border-brand/30",
									)}
								>
									<img src={ending.image} alt="" className="size-9 object-contain" />
									<span className="text-xs font-semibold text-foreground">{ending.name}</span>
								</button>
								{unavailable && (
									<button
										type="button"
										aria-label={`Why ${ending.name} is unavailable`}
										aria-expanded={expanded}
										aria-controls={expanded ? "ending-blockers" : undefined}
										onClick={() =>
											setReason(expanded ? null : { ending: ending.id, mode: gameMode, target: targetEnding })
										}
										className="-mt-2 rounded-b-md bg-warning px-1 pt-3 pb-1 text-[10px] font-bold text-inverse transition-colors hover:bg-warning/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warning"
									>
										Unavailable
									</button>
								)}
							</div>
						);
					})}
				</div>
			</div>
			{reason && visibleBlockers.length > 0 && (
				<section
					id="ending-blockers"
					aria-labelledby="ending-blockers-heading"
					className="relative mt-6 w-full rounded-md border border-warning/30 bg-warning/10 p-4 pr-12"
				>
					<button
						type="button"
						aria-label="Close unavailable ending reason"
						onClick={() => setReason(null)}
						className="absolute top-3 right-3 rounded p-1 text-warning hover:bg-warning/15 focus-visible:outline-2 focus-visible:outline-warning"
					>
						<X aria-hidden="true" className="size-4" />
					</button>
					<h2 id="ending-blockers-heading" className="flex items-center gap-2 text-sm font-semibold text-warning">
						<TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
						{STORY_ENDING_BY_ID[reason.ending].name} is unavailable due to{" "}
						{visibleBlockers.length === 1 ? "a choice:" : "these choices:"}
					</h2>
					<ul className="mt-3 space-y-2 text-sm text-foreground">
						{visibleBlockers.map(({ decision, option }) => {
							const chapter = storyChapterLink(decision.chapterId);
							return (
								<li key={decision.id}>
									{decision.prompt} — <strong>“{option.label}”</strong>.
									{chapter && (
										<>
											{" "}
											<Link href={chapter.href} className="underline underline-offset-2 hover:text-brand">
												Review in {chapter.name}
											</Link>
										</>
									)}
								</li>
							);
						})}
					</ul>
				</section>
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
			<StoryEvidenceRow progress={hydrated ? progress : null} />
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
	const view = progress ? buildChapterView(chapter, STORY_DECISIONS, progress) : null;
	const stats = view?.stats;
	const complete = view ? chapterCompletionState(view).complete : false;
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
				className="absolute inset-0 h-full w-full object-cover opacity-65 transition-opacity group-hover:opacity-80 [[data-theme=light]_&]:opacity-100"
			/>
			<div
				aria-hidden="true"
				className="absolute inset-0 bg-linear-to-r from-background/55 via-background/15 to-transparent [[data-theme=light]_&]:from-background/75 [[data-theme=light]_&]:via-background/10"
			/>
			{complete && (
				<div aria-hidden="true" className="absolute inset-0 bg-linear-to-l from-info/45 via-info/10 to-transparent" />
			)}
			<div className="relative flex flex-1 items-center gap-3 p-4">
				<img src={chapter.icon} alt="" className="h-9 w-auto" />
				<div className="min-w-0 flex-1">
					<h2 className="text-lg font-semibold text-foreground">{chapter.name}</h2>
					{stats && (
						<p className="text-xs font-bold text-foreground">
							{stats.requiredDone} of {stats.requiredTotal} steps done
							{stats.pendingRequired > 0 ? ` · ${stats.pendingRequired} depend on choices` : ""}
						</p>
					)}
					{evidence}
				</div>
				{ending && <img src={ending.image} alt={ending.name} title={`Target: ${ending.name}`} className="size-10" />}
				{complete && <span className="shrink-0 text-sm font-extrabold tracking-widest text-info">DONE</span>}
			</div>
		</Link>
	);
}
