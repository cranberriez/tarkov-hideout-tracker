"use client";

import { AlertTriangle } from "lucide-react";
import { entityLinkClassName } from "@/components/entities/entity-preview";
import { QuestLink } from "@/components/entities/quest-link";
import { SectionLabel } from "@/components/ui/detail-section";
import { getQuestFailConditionText } from "@/lib/quests/quest-failures";
import { cn } from "@/lib/utils";
import type { FullQuest } from "@/types/quests";
import { StandingRewards } from "./QuestRewards";

export function QuestMultipleChoiceBanner({
	quest,
	multipleChoiceQuests,
}: {
	quest: FullQuest;
	multipleChoiceQuests: readonly FullQuest[];
}) {
	return (
		<div className="flex h-11 min-h-11 items-stretch border-b border-warning/25 bg-warning/10 text-warning">
			<div className="flex min-w-0 flex-1 items-center gap-3 px-5 sm:px-7">
				<AlertTriangle size={16} className="shrink-0 text-warning" />
				<p className="shrink-0 text-[11px] font-bold uppercase tracking-[0.14em] text-warning">Multiple choice quest</p>
				<div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden text-xs">
					{multipleChoiceQuests.map((choiceQuest) =>
						choiceQuest.id === quest.id ? (
							<span key={choiceQuest.id} className="shrink-0 font-semibold text-warning">
								{choiceQuest.name}
							</span>
						) : (
							<QuestLink
								key={choiceQuest.id}
								questId={choiceQuest.id}
								quest={choiceQuest}
								className={cn(entityLinkClassName, "shrink-0 text-warning/70 decoration-warning/30 hover:text-warning")}
							/>
						),
					)}
				</div>
			</div>
		</div>
	);
}

export function QuestUnlocks({ leadsTo }: { leadsTo: readonly { quest: FullQuest; timing: string }[] }) {
	return (
		<section className="min-w-[14rem] flex-[1_1_16rem]">
			<SectionLabel>Unlocks</SectionLabel>
			<div className="space-y-2.5 text-sm">
				{leadsTo.map(({ quest: nextQuest, timing }) => (
					<div key={nextQuest.id}>
						<p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-subtle-foreground">{timing}</p>
						<QuestLink
							questId={nextQuest.id}
							quest={nextQuest}
							className={cn(entityLinkClassName, "text-foreground")}
						/>
					</div>
				))}
			</div>
		</section>
	);
}

export function QuestFailureConditions({
	quest,
	questsById,
}: {
	quest: FullQuest;
	questsById: ReadonlyMap<string, FullQuest>;
}) {
	return (
		<section className="min-w-[16rem] flex-[1_1_18rem]">
			<SectionLabel>Failure conditions</SectionLabel>
			<div className="space-y-5">
				{(quest.failConditions?.length ?? 0) > 0 && (
					<div className="space-y-2">
						{quest.failConditions?.map((condition) => {
							const referencedQuest =
								condition.type === "taskStatus" && "task" in condition ? questsById.get(condition.task.id) : null;
							return (
								<div key={condition.id} className="rounded-md bg-danger/[0.07] px-3 py-2 text-xs text-danger/80">
									{referencedQuest ? (
										<QuestLink
											questId={referencedQuest.id}
											quest={referencedQuest}
											className={cn(entityLinkClassName, "decoration-danger/30 hover:text-danger")}
										/>
									) : (
										<p>{getQuestFailConditionText(condition)}</p>
									)}
									{condition.type === "taskStatus" && "status" in condition && (
										<p className="mt-1 text-[10px] text-danger/40">Quest status: {condition.status.join(" or ")}</p>
									)}
								</div>
							);
						})}
					</div>
				)}
				{(quest.failureTraderStandingRewards?.length ?? 0) > 0 && (
					<StandingRewards label="Failure reputation" rewards={quest.failureTraderStandingRewards ?? []} />
				)}
			</div>
		</section>
	);
}
