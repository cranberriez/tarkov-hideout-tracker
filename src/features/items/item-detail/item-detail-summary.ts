import type { DerivedQuestItemState } from "@/lib/quests/quest-item-index";

interface SummaryHideoutRequirement {
	count: number;
	isFir: boolean;
	isCompleted: boolean;
	requirementId: string;
}

interface ItemDetailDemandSummaryOptions {
	stationRequirements: ReadonlyArray<readonly [string, ReadonlyArray<SummaryHideoutRequirement>]>;
	completedRequirements: Record<string, boolean>;
	questItemState: Pick<DerivedQuestItemState, "requiredCount" | "requiredFirCount"> | null;
}

export interface ItemDetailDemandSummary {
	hideoutRequiredCount: number;
	hideoutRequiredFirCount: number;
	questRequiredCount: number;
	questRequiredFirCount: number;
	totalRequiredCount: number;
	totalRequiredFirCount: number;
}

export function summarizeItemDetailDemand({
	stationRequirements,
	completedRequirements,
	questItemState,
}: ItemDetailDemandSummaryOptions): ItemDetailDemandSummary {
	let hideoutRequiredCount = 0;
	let hideoutRequiredFirCount = 0;

	for (const [, requirements] of stationRequirements) {
		for (const requirement of requirements) {
			if (requirement.isCompleted || completedRequirements[requirement.requirementId]) {
				continue;
			}

			hideoutRequiredCount += requirement.count;
			if (requirement.isFir) {
				hideoutRequiredFirCount += requirement.count;
			}
		}
	}

	// The quest item index contains only specific item objectives. Any-of groups
	// stay in the usage list and never add to (or subtract from) exact demand.
	const questRequiredCount = questItemState?.requiredCount ?? 0;
	const questRequiredFirCount = questItemState?.requiredFirCount ?? 0;

	return {
		hideoutRequiredCount,
		hideoutRequiredFirCount,
		questRequiredCount,
		questRequiredFirCount,
		totalRequiredCount: hideoutRequiredCount + questRequiredCount,
		totalRequiredFirCount: hideoutRequiredFirCount + questRequiredFirCount,
	};
}
