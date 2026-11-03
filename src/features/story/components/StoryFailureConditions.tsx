import { ModeLink } from "@/components/core/ModeLink";
import { Check, OctagonX, TriangleAlert } from "lucide-react";
import { STORY_CHAPTERS, STORY_DECISIONS, STORY_ENDING_BY_ID } from "@/lib/data/story";
import { questPath } from "@/lib/entity-routes";
import { cn } from "@/lib/utils";
import { buildStoryFailureConditions, groupStoryFailureConditions } from "../story-failure-conditions";
import type { StoryProgress } from "../story-progress";

export function StoryFailureConditions({
	progress,
	completedQuests,
}: {
	progress: StoryProgress | null;
	completedQuests: Readonly<Record<string, boolean>>;
}) {
	const ending = progress?.targetEnding;
	const groups = groupStoryFailureConditions(
		ending ? buildStoryFailureConditions(STORY_CHAPTERS, STORY_DECISIONS, ending, progress, completedQuests) : [],
	);
	return (
		<section className="mt-8" aria-labelledby="story-failures-heading">
			<h2 id="story-failures-heading" className="text-sm font-semibold text-foreground">
				FAILURE CONDITIONS
			</h2>
			{!ending && (
				<p className="mt-2 text-sm text-muted-foreground">
					{progress ? "Select an ending above to see its failure conditions." : "Loading selected ending…"}
				</p>
			)}
			{groups.map((group) => {
				const muted = group.kind === "resolved";
				const Icon = muted ? Check : group.kind === "route" ? OctagonX : TriangleAlert;
				const tone = muted ? "text-muted-foreground" : group.kind === "route" ? "text-danger" : "text-warning";
				return (
					<div key={group.kind} className="mt-4">
						<h3 className={cn("flex items-center gap-2 text-xs font-bold tracking-wide", tone)}>
							<Icon className="size-4" aria-hidden="true" />
							{muted
								? "PASSED / COMPLETED"
								: group.kind === "route"
									? `FAILS ${STORY_ENDING_BY_ID[ending!].name.toUpperCase()}`
									: "OBJECTIVE RISKS"}
						</h3>
						{group.chapters.map((chapter) => (
							<div key={chapter.chapterId} className="mt-3">
								<h4 className={cn("mb-1.5 text-xs font-semibold", muted ? "text-muted-foreground" : "text-foreground")}>
									{chapter.chapterName}
								</h4>
								<ul className="grid items-start gap-2 md:grid-cols-2">
									{chapter.entries.map((risk) => {
										const RiskIcon = risk.kind === "route" ? OctagonX : TriangleAlert;
										return (
											<li
												key={risk.id}
												className={cn(
													"rounded-md border px-3 py-2",
													muted
														? "border-highlight/5 bg-card/40 text-muted-foreground"
														: risk.kind === "route"
															? "border-danger/20 bg-danger/5 text-foreground"
															: "border-highlight/10 bg-card text-foreground",
												)}
											>
												<div className="flex items-start gap-2">
													<RiskIcon aria-hidden="true" className={cn("mt-0.5 size-3.5 shrink-0", tone)} />
													<div className="min-w-0 flex-1">
														<ModeLink
															href={risk.href}
															className={cn(
																"block text-xs font-semibold leading-5 hover:underline",
																!muted && risk.kind === "route" && "text-danger",
															)}
														>
															{risk.title}
														</ModeLink>
														<p className="text-xs leading-5">{risk.text}</p>
														{muted && (
															<span className="text-[11px]">
																{risk.status === "inapplicable"
																	? "Not on your chosen route"
																	: risk.status === "completed"
																		? "Completed"
																		: "Passed"}
															</span>
														)}
														{(risk.conditions.length > 0 || risk.quests.length > 0) && (
															<details className="mt-1 text-xs text-muted-foreground">
																<summary className="w-fit cursor-pointer hover:text-foreground">Details</summary>
																{risk.conditions.length > 0 && (
																	<p className="mt-1 leading-5">When: {risk.conditions.join("; ")}</p>
																)}
																{risk.quests.map((quest) => (
																	<ModeLink
																		key={quest.id}
																		href={questPath(quest.id)}
																		prefetch={false}
																		className="mt-1 block underline underline-offset-2 hover:text-brand"
																	>
																		{quest.name}
																	</ModeLink>
																))}
															</details>
														)}
													</div>
												</div>
											</li>
										);
									})}
								</ul>
							</div>
						))}
					</div>
				);
			})}
		</section>
	);
}
