"use client";

import { useState } from "react";
import { ArrowRight, Check, FileSearch, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MAJOR_EVIDENCE_REQUIRED, STORY_ENDING_BY_ID, STORY_ENDINGS } from "@/lib/data/story";
import { cn } from "@/lib/utils";
import type { StoryDecision, StoryEndingId } from "@/types/story";
import type { endingRouteStats, ResolvedDecisions } from "../story-model";
import { StoryDecisionControl } from "./StoryDecisionControl";

export type EndingSummary = ReturnType<typeof endingRouteStats>;

interface StoryRoutePanelProps {
	majorFound: number;
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
	decisionTargets: ReadonlyMap<string, string | null>;
	onJumpDecision: (decisionId: string) => void;
}

export function StoryRoutePanel({
	majorFound,
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
	decisionTargets,
	onJumpDecision,
}: StoryRoutePanelProps) {
	const [changingEnding, setChangingEnding] = useState(false);
	const ending = targetEnding ? STORY_ENDING_BY_ID[targetEnding] : null;
	const summary = targetEnding ? endingSummaries[targetEnding] : null;
	const evidenceRequired = targetEnding ? (MAJOR_EVIDENCE_REQUIRED[targetEnding] ?? 0) : 0;
	const evidenceRemaining = Math.max(0, evidenceRequired - majorFound);
	const lightkeeperChoices = decisions.filter((decision) => summary?.lightkeeperDecisionIds.includes(decision.id));
	return (
		<div className="flex flex-col gap-4">
			<section className="rounded-md border border-highlight/10 bg-card p-4">
				<div className="flex items-center justify-between gap-2">
					<h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Target ending</h2>
					{ending && (
						<button
							type="button"
							onClick={() => setChangingEnding((value) => !value)}
							aria-expanded={changingEnding}
							className="rounded text-xs text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand"
						>
							{changingEnding ? "Cancel" : "Change"}
						</button>
					)}
				</div>
				{ending && summary && !changingEnding ? (
					<>
						<div className="mt-3 flex items-center gap-4">
							<img
								src={ending.image}
								alt=""
								className="size-20 shrink-0 object-contain drop-shadow-[0_2px_3px_var(--shadow)]"
							/>
							<div className="min-w-0">
								<h3 className="text-xl font-semibold text-foreground">{ending.name}</h3>
								<p className="mt-1 text-sm text-muted-foreground">
									{summary.pending ? `${summary.remaining}–${summary.remaining + summary.pending}` : summary.remaining}{" "}
									steps left
								</p>
								<p className="text-xs text-muted-foreground">in this chapter</p>
							</div>
						</div>
						{(summary.lightkeeperRemaining > 0 || summary.lightkeeperPending > 0 || evidenceRequired > 0) && (
							<div className="mt-4 space-y-3 border-t border-highlight/10 pt-3 text-xs">
								{(summary.lightkeeperRemaining > 0 || summary.lightkeeperPending > 0) && (
									<div className="flex items-center gap-2">
										<p
											className={cn(
												"flex items-center gap-2 font-medium",
												summary.lightkeeperRemaining > 0 && lightkeeperAccess === false
													? "text-danger"
													: "text-foreground",
											)}
										>
											{lightkeeperAccess === true ? (
												<Check className="size-3.5 text-success" aria-hidden="true" />
											) : (
												<TriangleAlert className="size-3.5" aria-hidden="true" />
											)}
											{summary.lightkeeperRemaining > 0 ? "Lightkeeper required" : "Lightkeeper may be required"}
										</p>
										{lightkeeperChoices
											.filter((decision) => decisionTargets.has(decision.id))
											.map((decision) => (
												<button
													key={decision.id}
													type="button"
													onClick={() => onJumpDecision(decision.id)}
													title={`Review choice: ${decision.prompt}`}
													aria-label={`Review choice: ${decision.prompt}`}
													className="inline-flex shrink-0 items-center justify-center rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand"
												>
													<ArrowRight aria-hidden="true" className="size-3.5 shrink-0" />
												</button>
											))}
									</div>
								)}
								{evidenceRequired > 0 && (
									<div>
										<p className="flex items-center gap-2 font-medium text-special">
											<FileSearch aria-hidden="true" className="size-3.5" />
											{evidenceRemaining
												? `${evidenceRemaining} major evidence still needed`
												: "Major evidence collected"}
										</p>
									</div>
								)}
							</div>
						)}
					</>
				) : (
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
									onClick={() => {
										onTargetEnding(ending.id);
										setChangingEnding(false);
									}}
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
										<Badge tone={lightkeeperConflict ? "danger" : "neutral"} variant="flat" size="sm">
											{lightkeeperConflict ? <TriangleAlert aria-hidden="true" /> : null}
											Lightkeeper
										</Badge>
									)}
								</button>
							);
						})}
					</div>
				)}
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

			{decisions.length > 0 && (
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
									onJump={decisionTargets.has(decision.id) ? () => onJumpDecision(decision.id) : undefined}
								/>
							</li>
						))}
					</ul>
				</section>
			)}
		</div>
	);
}
