import type { FullQuest } from "@/types";
import { getQuestTraderTabLoyaltyLevel } from "./quest-trader-completion-gates";
import { isQuestTraderLoyaltyRequirement } from "./quest-trader-gates";
import { getQuestLoyaltyLevelOverride } from "./quest-trader-tab-overrides";
import {
    isEssentialQuest,
    QUEST_SERIES_MANIFEST,
    type QuestSeriesManifest,
} from "./quest-series";

export {
    QUEST_SERIES_MANIFEST,
    type QuestSeriesDefinition,
    type QuestSeriesManifest,
    type QuestSeriesMember,
} from "./quest-series";

export type QuestCategory = "tier-1" | "tier-2" | "tier-3" | "tier-4" | "series";

export interface DerivedQuestOrganization {
    questId: string;
    category: QuestCategory;
    issuingTraderTier: 1 | 2 | 3 | 4;
    seriesId: string | null;
    seriesName: string | null;
    seriesOrder: number | null;
}

export type QuestOrganizationValidationCode =
    | "duplicate-series-id"
    | "unknown-quest-id"
    | "duplicate-series-membership"
    | "duplicate-series-order"
    | "invalid-series-order"
    | "trader-mismatch"
    | "invalid-trader-tier";

export interface QuestOrganizationValidationIssue {
    code: QuestOrganizationValidationCode;
    message: string;
    seriesId?: string;
    questId?: string;
    order?: number;
    traderId?: string;
    expectedTraderId?: string;
    value?: number;
    clampedValue?: 1 | 2 | 3 | 4;
}

export interface QuestOrganizationResult {
    entries: DerivedQuestOrganization[];
    byQuestId: Map<string, DerivedQuestOrganization>;
    validationIssues: QuestOrganizationValidationIssue[];
}

function getOwnTraderTier(
    quest: FullQuest,
    validationIssues: QuestOrganizationValidationIssue[],
): 1 | 2 | 3 | 4 {
    const override = getQuestLoyaltyLevelOverride(quest.id);
    if (override !== null) return override;

    const ownLevelRequirements = (quest.traderRequirements ?? []).filter(
        (requirement) =>
            requirement.trader.id === quest.trader.id && isQuestTraderLoyaltyRequirement(requirement),
    );

    if (ownLevelRequirements.length === 0) return getQuestTraderTabLoyaltyLevel(quest);

    let highestValidTier = 1;
    for (const requirement of ownLevelRequirements) {
        const value = requirement.value;
        const isValidNumber = typeof value === "number" && Number.isFinite(value);
        const roundedValue = isValidNumber ? Math.round(value) : 1;
        const clampedValue = Math.min(4, Math.max(1, roundedValue)) as 1 | 2 | 3 | 4;

        if (!isValidNumber || value < 1 || value > 4 || !Number.isInteger(value)) {
            validationIssues.push({
                code: "invalid-trader-tier",
                message: `Quest ${quest.id} has an invalid issuing-trader tier (${String(value)}); clamped to LL${clampedValue}.`,
                questId: quest.id,
                traderId: quest.trader.id,
                value: typeof value === "number" ? value : undefined,
                clampedValue,
            });
        }

        highestValidTier = Math.max(highestValidTier, clampedValue);
    }

    return Math.max(
        highestValidTier,
        getQuestTraderTabLoyaltyLevel(quest),
    ) as 1 | 2 | 3 | 4;
}

export function validateQuestSeriesManifest(
    quests: FullQuest[],
    manifest: QuestSeriesManifest = QUEST_SERIES_MANIFEST,
): QuestOrganizationValidationIssue[] {
    const issues: QuestOrganizationValidationIssue[] = [];
    const questsById = new Map(quests.map((quest) => [quest.id, quest]));
    const seriesIds = new Set<string>();
    const membershipByQuestId = new Map<string, string>();

    for (const series of manifest.series ?? []) {
        if (seriesIds.has(series.id)) {
            issues.push({
                code: "duplicate-series-id",
                message: `Series ID ${series.id} appears more than once in the manifest.`,
                seriesId: series.id,
            });
        }
        seriesIds.add(series.id);

        const orders = new Set<number>();
        for (const member of series.members ?? []) {
            const quest = questsById.get(member.questId);
            if (!quest) {
                issues.push({
                    code: "unknown-quest-id",
                    message: `Series ${series.id} references unknown quest ${member.questId}.`,
                    seriesId: series.id,
                    questId: member.questId,
                    order: member.order,
                });
            } else {
                const previousSeriesId = membershipByQuestId.get(member.questId);
                if (previousSeriesId) {
                    issues.push({
                        code: "duplicate-series-membership",
                        message: `Quest ${member.questId} belongs to both ${previousSeriesId} and ${series.id}.`,
                        seriesId: series.id,
                        questId: member.questId,
                    });
                } else {
                    membershipByQuestId.set(member.questId, series.id);
                }

                if (!series.allowCrossTrader && quest.trader.id !== series.traderId) {
                    issues.push({
                        code: "trader-mismatch",
                        message: `Quest ${member.questId} is issued by ${quest.trader.id}, not the manifest trader ${series.traderId}.`,
                        seriesId: series.id,
                        questId: member.questId,
                        traderId: quest.trader.id,
                        expectedTraderId: series.traderId,
                    });
                }
            }

            if (
                typeof member.order !== "number" ||
                !Number.isFinite(member.order) ||
                !Number.isInteger(member.order) ||
                member.order < 1
            ) {
                issues.push({
                    code: "invalid-series-order",
                    message: `Series ${series.id} has an invalid order for quest ${member.questId}.`,
                    seriesId: series.id,
                    questId: member.questId,
                    order: member.order,
                });
            } else if (orders.has(member.order)) {
                issues.push({
                    code: "duplicate-series-order",
                    message: `Series ${series.id} uses order ${member.order} more than once.`,
                    seriesId: series.id,
                    questId: member.questId,
                    order: member.order,
                });
            }

            if (typeof member.order === "number" && Number.isFinite(member.order)) {
                orders.add(member.order);
            }
        }
    }

    return issues;
}

export function deriveQuestOrganization(
    quests: FullQuest[],
    manifest: QuestSeriesManifest = QUEST_SERIES_MANIFEST,
): QuestOrganizationResult {
    const validationIssues = validateQuestSeriesManifest(quests, manifest);
    const seriesByQuestId = new Map<string, {
        seriesId: string;
        seriesName: string;
        seriesOrder: number;
    }>();

    for (const series of manifest.series ?? []) {
        for (const member of series.members ?? []) {
            if (!seriesByQuestId.has(member.questId)) {
                seriesByQuestId.set(member.questId, {
                    seriesId: series.id,
                    seriesName: series.name,
                    seriesOrder: member.order,
                });
            }
        }
    }

    const entries: DerivedQuestOrganization[] = [];
    const byQuestId = new Map<string, DerivedQuestOrganization>();
    const tierIssues: QuestOrganizationValidationIssue[] = [];

    for (const quest of quests) {
        const manifestSeries = seriesByQuestId.get(quest.id);
        const series = manifestSeries ?? (isEssentialQuest(quest.id)
            ? {
                  seriesId: `essential-unassigned-${quest.trader.id}`,
                  seriesName: "Other essential quests",
                  seriesOrder: Number.MAX_SAFE_INTEGER,
              }
            : undefined);
        const issuingTraderTier = getOwnTraderTier(quest, tierIssues);
        const entry: DerivedQuestOrganization = {
            questId: quest.id,
            category: series ? "series" : (`tier-${issuingTraderTier}` as QuestCategory),
            issuingTraderTier,
            seriesId: series?.seriesId ?? null,
            seriesName: series?.seriesName ?? null,
            seriesOrder: series?.seriesOrder ?? null,
        };
        entries.push(entry);
        byQuestId.set(entry.questId, entry);
    }

    return {
        entries,
        byQuestId,
        validationIssues: [...validationIssues, ...tierIssues],
    };
}

export const buildQuestOrganization = deriveQuestOrganization;
