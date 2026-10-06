"use client";

import { TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { STORY_ENDINGS } from "@/lib/data/story";
import { cn } from "@/lib/utils";
import type { StoryDecision, StoryEndingId } from "@/types/story";
import type { ResolvedDecisions } from "../story-model";
import { StoryDecisionControl } from "./StoryDecisionControl";

export interface EndingSummary {
	remaining: number;
	pending: number;
	needsLightkeeper: boolean;
}

interface StoryRoutePanelProps {
	chapterId: string;
	targetEnding: StoryEndingId | null;
	reachable: ReadonlySet<StoryEndingId>;
	endingSummaries: Readonly<Record<StoryEndingId, EndingSummary>>;
	lightkeeperAccess: boolean | null;
	decisions: readonly StoryDecision[];
	resolved: ResolvedDecisions;
	onTargetEnding: (ending: StoryEndingId) => void;
	onLightkeeperAccess: (access: boolean) => void;
	onDecision: (decisionId: string, optionId: string) => void;
}

export function StoryRoutePanel({
	chapterId,
	targetEnding,
	reachable,
	endingSummaries,
	lightkeeperAccess,
	decisions,
	resolved,
	onTargetEnding,
	onLightkeeperAccess,
	onDecision,
}: StoryRoutePanelProps) {
	return (
		<div className="flex flex-col gap-4">
			<section className="rounded-md border border-highlight/10 bg-card p-4">
				<h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Target ending</h2>
				<div className="mt-3 grid grid-cols-2 gap-2">
					{STORY_ENDINGS.map((ending) => {
						const selected = targetEnding === ending.id;
						const isReachable = reachable.has(ending.id);
						const summary = endingSummaries[ending.id];
						const lightkeeperConflict = summary.needsLightkeeper && lightkeeperAccess === false;
						return (
							<button
								key={ending.id}
								type="button"
								aria-pressed={selected}
								onClick={() => onTargetEnding(ending.id)}
								title={ending.summary}
								className={cn(
									"flex flex-col items-center gap-1 rounded-md border p-2 text-center transition-colors",
									selected
										? "border-brand/60 bg-brand/10"
										: "border-highlight/10 bg-shadow/30 hover:border-brand/30 hover:bg-brand/5",
									!isReachable && "opacity-45",
								)}
							>
								<img src={ending.image} alt="" className="size-14 object-contain" />
								<span className="text-sm font-semibold text-foreground">{ending.name}</span>
								<span className="text-[11px] text-muted-foreground">
									{!isReachable
										? "Ruled out by your choices"
										: summary.remaining === 0 && summary.pending === 0
											? "Complete"
											: summary.pending
												? `${summary.remaining}–${summary.remaining + summary.pending} steps left`
												: `${summary.remaining} steps left`}
								</span>
								{summary.needsLightkeeper && isReachable && (
									<Badge tone={lightkeeperConflict ? "danger" : "neutral"} size="xs">
										{lightkeeperConflict ? <TriangleAlert aria-hidden="true" /> : null}
										Lightkeeper
									</Badge>
								)}
							</button>
						);
					})}
				</div>
				{targetEnding && !reachable.has(targetEnding) && (
					<p role="alert" className="mt-3 text-xs text-warning">
						Your recorded choices rule out this ending.
					</p>
				)}
			</section>

			<section className="flex items-center justify-between gap-3 rounded-md border border-highlight/10 bg-card px-4 py-1.5">
				<h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Lightkeeper access</h2>
				<div className="inline-flex rounded-md border border-highlight/10 bg-shadow/30 p-1">
					{[
						{ value: true, label: "Yes" },
						{ value: false, label: "No" },
					].map((option) => (
						<button
							key={option.label}
							type="button"
							aria-pressed={lightkeeperAccess === option.value}
							onClick={() => onLightkeeperAccess(option.value)}
							className={cn(
								"min-w-14 rounded px-3 py-1 text-sm font-semibold transition-colors",
								lightkeeperAccess === option.value
									? "bg-brand text-inverse"
									: "text-muted-foreground hover:bg-highlight/5 hover:text-foreground",
							)}
						>
							{option.label}
						</button>
					))}
				</div>
			</section>

			<section className="rounded-md border border-highlight/10 bg-card p-4">
				<h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Choices</h2>
				<ul className="mt-3 flex flex-col gap-4">
					{decisions.map((decision) => (
						<li key={decision.id}>
							<StoryDecisionControl
								decision={decision}
								chapterId={chapterId}
								resolved={resolved}
								targetEnding={targetEnding}
								onDecision={onDecision}
							/>
						</li>
					))}
				</ul>
			</section>
		</div>
	);
}
