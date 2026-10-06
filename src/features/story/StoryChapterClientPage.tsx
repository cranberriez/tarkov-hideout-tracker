"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ChevronLeft, ExternalLink } from "lucide-react";
import {
	findStoryChapter,
	MAJOR_EVIDENCE,
	MINOR_EVIDENCE,
	STORY_DECISION_BY_ID,
	STORY_DECISIONS,
	STORY_ENDING_BY_ID,
	STORY_ENDINGS,
	storyChapterLink,
} from "@/lib/data/story";
import { useUserStoreHydrated } from "@/lib/query/game-data";
import { useUserStore } from "@/lib/stores/useUserStore";
import type { StoryEndingId } from "@/types/story";
import { ChapterBadge } from "./components/StoryDecisionControl";
import { StoryEvidencePanel } from "./components/StoryEvidencePanel";
import { StoryItemChip } from "./components/StoryItemChip";
import { StoryRoutePanel, type EndingSummary } from "./components/StoryRoutePanel";
import { StoryStepList } from "./components/StoryStepList";
import {
	buildChapterView,
	chapterEvidence,
	decisionLocations,
	endingRouteStats,
	evaluateCondition,
	reachableEndings,
} from "./story-model";
import { setStoryStepDone, toggleStoryDecision } from "./story-progress";
import { useStoryProgress } from "./useStoryProgress";

const ENDING_IDS = STORY_ENDINGS.map((ending) => ending.id);

export function StoryChapterClientPage({ chapterId }: { chapterId: string }) {
	const chapter = findStoryChapter(chapterId)!;
	const hydrated = useUserStoreHydrated();
	const gameMode = useUserStore((state) => state.gameMode);
	const [progress, update] = useStoryProgress(gameMode);

	const view = useMemo(() => buildChapterView(chapter, STORY_DECISIONS, progress), [chapter, progress]);
	const reachable = useMemo(
		() => reachableEndings(STORY_DECISIONS, progress.decisions, ENDING_IDS),
		[progress.decisions],
	);
	const endingSummaries = useMemo(
		() =>
			Object.fromEntries(
				ENDING_IDS.map((ending) => [ending, endingRouteStats(chapter, STORY_DECISIONS, progress, ending)]),
			) as Record<StoryEndingId, EndingSummary>,
		[chapter, progress],
	);
	const chapterDecisions = useMemo(
		() =>
			chapter.decisionIds
				.map((id) => STORY_DECISION_BY_ID[id])
				.filter((decision) => decision && evaluateCondition(decision.when, view.resolved) !== false),
		[chapter, view.resolved],
	);

	const locations = useMemo(() => decisionLocations(chapter), [chapter]);
	const evidence = useMemo(() => chapterEvidence(chapter, MAJOR_EVIDENCE, MINOR_EVIDENCE), [chapter]);
	const completed = useMemo(() => new Set(progress.completedSteps[chapter.id] ?? []), [progress, chapter.id]);
	const stepOrder = useMemo(
		() =>
			view.sections.flatMap((section) =>
				section.steps.map((step) => ({
					id: step.step.id,
					autoComplete: step.state === "active" && !step.step.optional,
				})),
			),
		[view.sections],
	);
	const previousChapters = chapter.previousChapterIds.map((id) => storyChapterLink(id)).filter((link) => link !== null);

	const { stats } = view;
	const remaining = stats.requiredTotal - stats.requiredDone;
	const percent = stats.requiredTotal ? Math.round((stats.requiredDone / stats.requiredTotal) * 100) : 0;
	const onDecision = (decisionId: string, optionId: string) =>
		update((current) => toggleStoryDecision(current, decisionId, optionId));

	return (
		<main className="container mx-auto flex-1 px-4 py-6 sm:px-6">
			<Link
				href="/story"
				className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
			>
				<ChevronLeft aria-hidden="true" className="size-4" />
				Story chapters
			</Link>

			<header className="relative mb-6 overflow-hidden rounded-md border border-highlight/10 bg-shadow/40">
				<img src={chapter.banner} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
				<div
					aria-hidden="true"
					className="absolute inset-0 bg-linear-to-r from-shadow/70 via-shadow/35 to-transparent"
				/>
				<div className="relative flex flex-col gap-3 p-5 sm:flex-row sm:items-end sm:justify-between">
					<div className="flex items-center gap-3">
						<img src={chapter.icon} alt="" className="h-10 w-auto" />
						<div>
							<h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{chapter.name}</h1>
							<p className="mt-0.5 max-w-xl text-sm text-muted-foreground">{chapter.summary}</p>
							{previousChapters.length > 0 && (
								<div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
									Follows
									{previousChapters.map((link) => (
										<ChapterBadge key={link.href} {...link} />
									))}
								</div>
							)}
						</div>
					</div>
					<a
						href={chapter.wikiLink}
						target="_blank"
						rel="noreferrer"
						className="inline-flex items-center gap-1 self-start text-xs text-muted-foreground hover:text-foreground sm:self-auto"
					>
						Wiki
						<ExternalLink aria-hidden="true" className="size-3" />
					</a>
				</div>
			</header>

			{!hydrated ? (
				<p className="text-sm text-muted-foreground">Loading your progress…</p>
			) : (
				<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
					<aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:order-last lg:max-h-[calc(100dvh-3rem)] lg:self-start lg:overflow-y-auto lg:overscroll-contain lg:pr-1 [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]">
						<section className="rounded-md border border-highlight/10 bg-card p-4" aria-label="Progress">
							<div className="flex items-baseline justify-between gap-2">
								<span className="text-2xl font-bold text-foreground">{remaining}</span>
								<span className="text-xs text-muted-foreground">
									{stats.requiredDone} of {stats.requiredTotal} steps done
								</span>
							</div>
							<p className="text-sm text-muted-foreground">
								steps left{progress.targetEnding ? ` to ${STORY_ENDING_BY_ID[progress.targetEnding].name}` : ""}
							</p>
							<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-highlight/10">
								<div className="h-full bg-brand transition-all" style={{ width: `${percent}%` }} />
							</div>
							{stats.pendingRequired > 0 && (
								<p className="mt-2 text-xs text-info">
									Up to {stats.pendingRequired} more step{stats.pendingRequired === 1 ? "" : "s"}, depending on choices
									you haven&apos;t recorded.
									{progress.targetEnding ? "" : " Pick a target ending to narrow them down."}
								</p>
							)}
							{stats.lightkeeperRemaining > 0 && progress.lightkeeperAccess === false && (
								<p className="mt-2 text-xs text-danger">
									{stats.lightkeeperRemaining} remaining step{stats.lightkeeperRemaining === 1 ? " needs" : "s need"}{" "}
									Lightkeeper access.
								</p>
							)}
						</section>

						{evidence.entries.length > 0 && (
							<StoryEvidencePanel
								entries={evidence.entries}
								completed={completed}
								targetEnding={progress.targetEnding}
							/>
						)}

						<StoryRoutePanel
							chapterId={chapter.id}
							targetEnding={progress.targetEnding}
							reachable={reachable}
							endingSummaries={endingSummaries}
							lightkeeperAccess={progress.lightkeeperAccess}
							decisions={chapterDecisions}
							resolved={view.resolved}
							onTargetEnding={(ending) =>
								update((current) => ({
									...current,
									targetEnding: current.targetEnding === ending ? null : ending,
								}))
							}
							onLightkeeperAccess={(access) =>
								update((current) => ({
									...current,
									lightkeeperAccess: current.lightkeeperAccess === access ? null : access,
								}))
							}
							onDecision={onDecision}
						/>

						{stats.itemsNeeded.length > 0 && (
							<section className="rounded-md border border-highlight/10 bg-card p-4">
								<h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
									Items for remaining steps
								</h2>
								<div className="mt-3 flex flex-wrap gap-1.5">
									{stats.itemsNeeded.map(({ key, item }) => (
										<StoryItemChip key={key} item={item} />
									))}
								</div>
							</section>
						)}
					</aside>

					<StoryStepList
						chapterId={chapter.id}
						locations={locations}
						evidenceByStep={evidence.byStep}
						sections={view.sections}
						resolved={view.resolved}
						targetEnding={progress.targetEnding}
						onToggleStep={(stepId, done) =>
							update((current) => setStoryStepDone(current, chapter.id, stepOrder, stepId, done))
						}
						onDecision={onDecision}
					/>
				</div>
			)}
		</main>
	);
}
