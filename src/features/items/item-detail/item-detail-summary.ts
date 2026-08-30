import type {
    DerivedQuestAnyOfGroup,
    DerivedQuestItemState,
} from "@/lib/utils/quest-item-index";

interface SummaryHideoutRequirement {
    count: number;
    isFir: boolean;
    isCompleted: boolean;
    requirementId: string;
}

interface ItemDetailDemandSummaryOptions {
    stationRequirements: ReadonlyArray<
        readonly [string, ReadonlyArray<SummaryHideoutRequirement>]
    >;
    completedRequirements: Record<string, boolean>;
    questItemState: Pick<
        DerivedQuestItemState,
        "requiredCount" | "requiredFirCount"
    > | null;
    anyOfGroups: ReadonlyArray<
        Pick<DerivedQuestAnyOfGroup, "requiredCount" | "requiredFirCount" | "status">
    >;
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
    anyOfGroups,
}: ItemDetailDemandSummaryOptions): ItemDetailDemandSummary {
    let hideoutRequiredCount = 0;
    let hideoutRequiredFirCount = 0;

    for (const [, requirements] of stationRequirements) {
        for (const requirement of requirements) {
            if (
                requirement.isCompleted ||
                completedRequirements[requirement.requirementId]
            ) {
                continue;
            }

            hideoutRequiredCount += requirement.count;
            if (requirement.isFir) {
                hideoutRequiredFirCount += requirement.count;
            }
        }
    }

    // Exact quest demand also contains any-of objectives. Keep those objectives in
    // the usage list, but do not claim that every alternative item is required.
    const activeAnyOfCount = anyOfGroups.reduce(
        (sum, group) => sum + (group.status === "completed" ? 0 : group.requiredCount),
        0,
    );
    const activeAnyOfFirCount = anyOfGroups.reduce(
        (sum, group) =>
            sum + (group.status === "completed" ? 0 : group.requiredFirCount),
        0,
    );
    const questRequiredCount = Math.max(
        0,
        (questItemState?.requiredCount ?? 0) - activeAnyOfCount,
    );
    const questRequiredFirCount = Math.max(
        0,
        (questItemState?.requiredFirCount ?? 0) - activeAnyOfFirCount,
    );

    return {
        hideoutRequiredCount,
        hideoutRequiredFirCount,
        questRequiredCount,
        questRequiredFirCount,
        totalRequiredCount: hideoutRequiredCount + questRequiredCount,
        totalRequiredFirCount: hideoutRequiredFirCount + questRequiredFirCount,
    };
}
