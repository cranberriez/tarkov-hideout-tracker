"use client";

import { entityLinkClassName } from "@/components/entities/entity-preview";
import { QuestLink } from "@/components/entities/quest-link";
import { SectionLabel } from "@/components/ui/detail-section";
import { RequirementRow } from "@/components/ui/requirement";
import { formatQuestTraderGate, getQuestTraderGateType } from "@/lib/quests/quest-trader-gates";
import {
	compareTraderTierCompletionCount,
	countCompletedTraderTierQuests,
	formatTraderTierCompletionGate,
} from "@/lib/quests/quest-trader-completion-gates";
import { formatTaskRequirementStatus } from "@/lib/quests/quest-relations";
import type { FullQuest } from "@/types/quests";
import {
	compareRequirementValue,
	formatOtherRequirementDetails,
	humanize,
	isTaskRequirementSatisfied,
	type buildQuestDetailsModel,
} from "../quest-details-model";

type QuestDetailsModel = ReturnType<typeof buildQuestDetailsModel>;

/** Gates and prerequisites. Satisfaction comes from the existing quest-rule helpers. */
export function QuestRequirements({
	quest,
	quests,
	playerLevel,
	prestigeLevel,
	faction,
	traderLoyaltyLevels,
	fenceReputation,
	completedQuests,
	failedQuests,
	traderTierCompletionGates,
	unknownOtherRequirements,
	questsById,
}: {
	quest: FullQuest;
	quests: readonly FullQuest[];
	playerLevel: number;
	prestigeLevel: number;
	faction: string | null;
	traderLoyaltyLevels: Record<string, number>;
	fenceReputation: number;
	completedQuests: Record<string, boolean>;
	failedQuests: Record<string, boolean>;
	traderTierCompletionGates: QuestDetailsModel["traderTierCompletionGates"];
	unknownOtherRequirements: QuestDetailsModel["unknownOtherRequirements"];
	questsById: ReadonlyMap<string, FullQuest>;
}) {
	return (
		<section className="min-w-[16rem] flex-[1_1_18rem]">
			<SectionLabel>Requirements</SectionLabel>
			<div className="space-y-2.5 text-sm">
				{(quest.minPlayerLevel ?? 0) > 0 && (
					<RequirementRow satisfied={playerLevel >= (quest.minPlayerLevel ?? 0)} label="Player level">
						Level {quest.minPlayerLevel}
					</RequirementRow>
				)}
				{quest.factionName && quest.factionName !== "Any" && (
					<RequirementRow satisfied={faction ? faction === quest.factionName : null} label="Faction">
						{quest.factionName}
					</RequirementRow>
				)}
				{quest.requiredPrestige && (
					<RequirementRow satisfied={prestigeLevel >= quest.requiredPrestige.prestigeLevel} label="Prestige">
						Level {quest.requiredPrestige.prestigeLevel}
					</RequirementRow>
				)}
				{quest.traderRequirements.map((requirement) => {
					const gateType = getQuestTraderGateType(requirement);
					const isFence =
						requirement.trader.normalizedName === "fence" || requirement.trader.name.toLowerCase() === "fence";
					const currentValue =
						gateType === "level"
							? (traderLoyaltyLevels[requirement.trader.id] ?? 1)
							: gateType === "reputation" && isFence
								? fenceReputation
								: null;
					return (
						<RequirementRow
							key={requirement.id}
							satisfied={
								currentValue == null
									? null
									: compareRequirementValue(currentValue, requirement.compareMethod, requirement.value)
							}
							label="Trader"
						>
							{formatQuestTraderGate(requirement)}
						</RequirementRow>
					);
				})}
				{traderTierCompletionGates.map((gate) => {
					const completedCount = countCompletedTraderTierQuests(quests, completedQuests, gate);
					return (
						<RequirementRow
							key={gate.variableId}
							satisfied={compareTraderTierCompletionCount(completedCount, gate)}
							label="Tasks completed"
							title={formatTraderTierCompletionGate(gate)}
						>
							{completedCount}/{gate.requiredCount} {gate.trader} LL{gate.tier} tasks
						</RequirementRow>
					);
				})}
				{unknownOtherRequirements.map((requirement, index) => (
					<RequirementRow
						key={requirement.id ?? `${requirement.type}-${index}`}
						satisfied={null}
						label={humanize(requirement.requirementType || requirement.type || "Other")}
					>
						{formatOtherRequirementDetails(requirement) || "Required"}
					</RequirementRow>
				))}
				{quest.taskRequirements.map((requirement) => (
					<RequirementRow
						key={requirement.task.id}
						satisfied={isTaskRequirementSatisfied(
							requirement.status,
							!!completedQuests[requirement.task.id],
							!!failedQuests[requirement.task.id],
						)}
						label={formatTaskRequirementStatus(requirement.status)}
					>
						<QuestLink
							questId={requirement.task.id}
							quest={questsById.get(requirement.task.id)}
							name={requirement.task.name}
							className={entityLinkClassName}
						/>
					</RequirementRow>
				))}
			</div>
		</section>
	);
}
