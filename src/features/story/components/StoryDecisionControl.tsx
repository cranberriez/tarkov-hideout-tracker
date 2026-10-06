"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { STORY_ENDING_BY_ID, storyChapterLink } from "@/lib/data/story";
import { cn } from "@/lib/utils";
import type { StoryDecision, StoryEndingId } from "@/types/story";
import type { ResolvedDecisions } from "../story-model";

interface StoryDecisionControlProps {
	decision: StoryDecision;
	/** Chapter being viewed; decisions made elsewhere link to their chapter. */
	chapterId: string;
	resolved: ResolvedDecisions;
	targetEnding: StoryEndingId | null;
	onDecision: (decisionId: string, optionId: string) => void;
	/** Prompt beside the options on wide screens, for full-width bars. */
	layout?: "stacked" | "bar";
	id?: string;
	className?: string;
}

export function StoryDecisionControl({
	decision,
	chapterId,
	resolved,
	targetEnding,
	onDecision,
	layout = "stacked",
	id,
	className,
}: StoryDecisionControlProps) {
	const current = resolved[decision.id];
	const shownOption = decision.options.find((option) => option.id === current?.optionId);
	const source = decision.chapterId !== chapterId ? storyChapterLink(decision.chapterId) : null;
	return (
		<div id={id} className={cn("scroll-mt-24", className)}>
			<div
				className={cn(
					"flex flex-col gap-2",
					layout === "bar" && "sm:flex-row sm:items-center sm:justify-between sm:gap-4",
				)}
			>
				<div className="flex flex-wrap items-center gap-1.5">
					<span className="text-sm font-medium text-foreground">{decision.prompt}</span>
					{decision.pointOfNoReturn && (
						<Badge tone="warning" size="xs" title="Point of no return">
							<Lock aria-hidden="true" />
							Final
						</Badge>
					)}
					{source && <ChapterBadge {...source} />}
				</div>
				<div className="flex flex-wrap gap-2">
					{decision.options.map((option) => {
						const chosen = current?.source === "chosen" && current.optionId === option.id;
						const implied = current?.source === "implied" && current.optionId === option.id;
						const leadsAway = Boolean(targetEnding && option.endings && !option.endings.includes(targetEnding));
						const endingNames = option.endings?.map((ending) => STORY_ENDING_BY_ID[ending].name).join(", ");
						return (
							<button
								key={option.id}
								type="button"
								aria-pressed={chosen}
								onClick={() => onDecision(decision.id, option.id)}
								title={[
									endingNames && `Required for ${endingNames}`,
									implied && "Implied by your target ending",
									leadsAway && "Leads away from your target ending",
								]
									.filter(Boolean)
									.join(". ")}
								className={cn(
									"inline-flex min-h-9 items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors",
									chosen
										? "border-brand bg-brand text-inverse"
										: implied
											? "border-dashed border-brand/70 bg-brand/8 text-brand hover:bg-brand/15"
											: "border-highlight/15 bg-shadow/30 text-muted-foreground hover:border-brand/40 hover:text-foreground",
									leadsAway && !chosen && "opacity-45",
								)}
							>
								{option.label}
								{option.endings && (
									<span className="flex items-center -space-x-1">
										{option.endings.map((ending) => (
											<img
												key={ending}
												src={STORY_ENDING_BY_ID[ending].image}
												alt={STORY_ENDING_BY_ID[ending].name}
												className="size-5 object-contain"
											/>
										))}
									</span>
								)}
							</button>
						);
					})}
				</div>
			</div>
			{shownOption?.description && (
				<p className="mt-1.5 text-xs text-muted-foreground">
					{current?.source === "implied" ? "If chosen: " : ""}
					{shownOption.description}
				</p>
			)}
		</div>
	);
}

export function ChapterBadge({ name, href }: { name: string; href: string }) {
	return (
		<Link href={href} className="inline-flex">
			<Badge size="xs" className="hover:border-brand/40 hover:text-foreground">
				{name}
			</Badge>
		</Link>
	);
}
