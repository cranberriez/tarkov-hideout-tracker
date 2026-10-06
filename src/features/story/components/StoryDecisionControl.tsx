"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
	highlighted?: boolean;
	onJump?: () => void;
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
	highlighted = false,
	onJump,
	id,
	className,
}: StoryDecisionControlProps) {
	const current = resolved[decision.id];
	const shownOption = decision.options.find((option) => option.id === current?.optionId);
	const source = decision.chapterId !== chapterId ? storyChapterLink(decision.chapterId) : null;
	const tinted = highlighted || layout === "bar";
	const conflictsWithTarget = Boolean(
		current?.source === "chosen" && targetEnding && shownOption?.endings && !shownOption.endings.includes(targetEnding),
	);
	return (
		<div
			id={id}
			tabIndex={id ? -1 : undefined}
			className={cn(
				"scroll-mt-24 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info",
				tinted && "bg-info/10 px-3 py-3",
				conflictsWithTarget && !tinted && "rounded-none border-l-4 border-danger pl-3",
				className,
			)}
		>
			{conflictsWithTarget && targetEnding && (
				<p
					className={cn(
						"mb-2 text-xs font-bold",
						tinted ? "-mx-3 -mt-3 rounded-t-md bg-danger px-3 py-2 text-danger-foreground" : "text-danger",
					)}
				>
					This choice rules out {STORY_ENDING_BY_ID[targetEnding].name}.
				</p>
			)}
			<div
				className={cn(
					"flex flex-col gap-2",
					layout === "bar" && "sm:flex-row sm:items-center sm:justify-between sm:gap-4",
				)}
			>
				<div className="flex flex-wrap items-center gap-1.5">
					<span className="text-[15px] leading-6 font-medium text-foreground">{decision.prompt}</span>
					{decision.pointOfNoReturn && (
						<Badge tone="warning" variant="flat" size="sm" title="Point of no return">
							<Lock aria-hidden="true" />
							Final
						</Badge>
					)}
					{source && <ChapterBadge {...source} />}
				</div>
				<div className="flex flex-wrap items-center gap-2">
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
									tinted && [
										"rounded-sm border-0",
										chosen
											? "bg-info text-inverse"
											: implied
												? "bg-info/15 text-info hover:bg-info/25"
												: "bg-transparent text-info hover:bg-info/15 hover:text-info",
									],
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
					{onJump && (
						<Button
							variant="ghost"
							tone="info"
							size="md"
							iconOnly
							aria-label={`Jump to choice in objectives: ${decision.prompt}`}
							title="Jump to choice in objectives"
							onClick={onJump}
						>
							<ArrowRight aria-hidden="true" className="size-4" />
						</Button>
					)}
				</div>
			</div>
			{shownOption?.description && (
				<p
					className={cn(
						"mt-1.5 text-[13px] leading-5 text-muted-foreground",
						tinted && "text-sm leading-6 text-foreground/85",
					)}
				>
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
			<Badge variant="flat" size="sm" className="hover:bg-highlight/16 hover:text-foreground">
				{name}
				<ArrowUpRight aria-hidden="true" />
			</Badge>
		</Link>
	);
}
