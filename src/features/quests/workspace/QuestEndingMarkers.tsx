"use client";

import Link from "next/link";
import { STORY_ENDINGS, STORY_ENDING_BY_ID } from "@/lib/data/story/endings";
import { cn } from "@/lib/utils";
import { storyQuestFailures, storyQuestRequirements, useQuestWorkspace } from "./QuestWorkspaceContext";

export function QuestEndingFailureBanner({ questId }: { questId: string }) {
	const failures = storyQuestFailures.get(questId);
	if (!failures?.length) return null;
	return (
		<aside aria-label="Story ending failure warning" className="mb-8 space-y-3 rounded-sm bg-danger/10 px-4 py-3">
			{failures.map((entry) => (
				<div key={`${entry.chapterId}:${entry.stepId}`} className="flex items-center gap-3">
					<div className="flex shrink-0 -space-x-3">
						{entry.endings.map((id) => (
							<img
								key={id}
								src={STORY_ENDING_BY_ID[id].image}
								alt={STORY_ENDING_BY_ID[id].name}
								className="size-10 object-contain drop-shadow-[0_2px_3px_var(--shadow)]"
							/>
						))}
					</div>
					<p className="text-sm text-danger">
						Completing this quest fails the{" "}
						<strong>{entry.endings.map((id) => STORY_ENDING_BY_ID[id].name).join(", ")}</strong>
						{entry.endings.length === 1 ? " ending" : " endings"}. See{" "}
						<Link
							href={`/story/${entry.chapterId}#step-${entry.stepId}`}
							className="font-medium text-foreground underline underline-offset-2 hover:text-muted-foreground"
						>
							{entry.chapterName}
						</Link>
						.
					</p>
				</div>
			))}
		</aside>
	);
}

export function QuestEndingMarker({ questId, compact = false }: { questId: string; compact?: boolean }) {
	const { targetEnding, endingQuestIds } = useQuestWorkspace();
	if (!targetEnding || !endingQuestIds.has(questId)) return null;
	const ending = STORY_ENDING_BY_ID[targetEnding];
	return (
		<img
			src={ending.image}
			alt={`${ending.name} ending requirement`}
			title={`${ending.name} ending requirement — see quest details for route conditions`}
			className={cn(
				"shrink-0 object-contain drop-shadow-[0_2px_3px_var(--shadow)]",
				compact ? "ml-auto size-5" : "pointer-events-none absolute left-1 top-1/2 z-10 size-12 -translate-y-1/2",
			)}
		/>
	);
}

export function QuestEndingBanner({ questId }: { questId: string }) {
	const { targetEnding } = useQuestWorkspace();
	const requirements = storyQuestRequirements.get(questId);
	if (!requirements?.length) return null;
	const endings = STORY_ENDINGS.filter((ending) => requirements.some((entry) => entry.endings.includes(ending.id)));

	return (
		<aside
			aria-label="Story ending requirements"
			className="mb-8 flex items-center gap-4 rounded-sm bg-highlight/5 px-4 py-3"
		>
			<div
				className="isolate flex shrink-0 items-center -space-x-5"
				aria-label={endings.map((ending) => ending.name).join(", ")}
			>
				{endings.map((ending, index) => (
					<img
						key={ending.id}
						src={ending.image}
						alt={ending.name}
						title={`${ending.name}${ending.id === targetEnding ? " (selected)" : ""}`}
						style={{ zIndex: ending.id === targetEnding ? endings.length + 1 : endings.length - index }}
						className={cn(
							"relative shrink-0 object-contain drop-shadow-[0_2px_3px_var(--shadow)]",
							ending.id === targetEnding ? "size-12" : "size-10",
						)}
					/>
				))}
			</div>
			<div className="min-w-0 space-y-2 text-sm text-muted-foreground">
				{requirements.map((entry) => (
					<div key={`${entry.chapterId}:${entry.stepId}`}>
						<p>
							This quest is required {entry.conditions.length ? "on a route to the " : "for the "}
							<span className="font-semibold text-foreground">
								{entry.endings.map((id) => STORY_ENDING_BY_ID[id].name).join(", ")}
							</span>
							{entry.endings.length === 1 ? " ending" : " endings"} in{" "}
							<Link
								href={`/story/${entry.chapterId}#step-${entry.stepId}`}
								className="font-medium text-foreground underline underline-offset-2 hover:text-brand"
							>
								{entry.chapterName}
							</Link>
							.
						</p>
						{entry.note && <p className="mt-1 text-xs text-subtle-foreground">{entry.note}</p>}
					</div>
				))}
			</div>
		</aside>
	);
}
