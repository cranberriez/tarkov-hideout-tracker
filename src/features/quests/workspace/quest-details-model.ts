import type { MapOverlayMarker } from "@/types/maps";
import {
    getTraderTierCompletionGate,
    type TraderTierCompletionGate,
} from "../../../lib/utils/quest-trader-completion-gates";
import { isEssentialQuest } from "../../../lib/utils/quest-series";
import { formatQuestUnlockTiming } from "../../../lib/utils/quest-relations";
import type { FullQuest, QuestOtherRequirement } from "../../../types";
import { formatQuestMapSummary, type QuestMapGroup } from "../quest-map-groups";
import type { QuestBranchLine } from "./quest-branch-graph";
import {
    buildQuestDetailMarkers,
    createQuestDetailObjectiveStyles,
    getQuestDetailMaps,
} from "./quest-detail-markers";
import { buildObjectivePresentation } from "./quest-objective-presentation";

export interface QuestDetailMapData {
    questId: string;
    maps: ReturnType<typeof getQuestDetailMaps>;
    styles: ReturnType<typeof createQuestDetailObjectiveStyles>;
    markersByMap: Map<string, MapOverlayMarker[]>;
}

interface BuildQuestDetailsModelOptions {
    quest: FullQuest;
    questsById: ReadonlyMap<string, FullQuest>;
    leadsToQuestIds: readonly string[];
    maps: readonly QuestMapGroup[];
    branchLines: readonly QuestBranchLine[];
    multipleChoiceQuestIds: readonly string[];
    completedObjectiveIds: ReadonlySet<string>;
}

export function buildQuestDetailMapData(
    quest: FullQuest,
    completedObjectiveIds: ReadonlySet<string>,
): QuestDetailMapData {
    const maps = getQuestDetailMaps(quest);
    const styles = createQuestDetailObjectiveStyles(quest);
    return {
        questId: quest.id,
        maps,
        styles,
        markersByMap: new Map(
            maps.map((map) => [map.key, buildQuestDetailMarkers(quest, map.key, styles, completedObjectiveIds)]),
        ),
    };
}

export function buildQuestDetailsModel({
    quest,
    questsById,
    leadsToQuestIds,
    maps,
    branchLines,
    multipleChoiceQuestIds,
    completedObjectiveIds,
}: BuildQuestDetailsModelOptions) {
    const essential = isEssentialQuest(quest.id);
    const traderTierCompletionGates = quest.otherRequirements
        .map(getTraderTierCompletionGate)
        .filter((gate): gate is TraderTierCompletionGate => gate !== null);
    const unknownOtherRequirements = quest.otherRequirements.filter(
        (requirement) => !getTraderTierCompletionGate(requirement),
    );
    const leadsTo = leadsToQuestIds.flatMap((id) => {
        const nextQuest = questsById.get(id);
        if (!nextQuest) return [];
        const requirement = nextQuest.taskRequirements.find((entry) => entry.task.id === quest.id);
        return [{ quest: nextQuest, timing: formatQuestUnlockTiming(requirement?.status ?? []) }];
    });
    const hasRequirements = (quest.minPlayerLevel ?? 0) > 0 ||
        (!!quest.factionName && quest.factionName !== "Any") ||
        !!quest.requiredPrestige ||
        quest.traderRequirements.length > 0 ||
        quest.otherRequirements.length > 0 ||
        quest.taskRequirements.length > 0;
    const hasFailureDetails = (quest.failureTraderStandingRewards?.length ?? 0) > 0 ||
        (quest.failConditions?.length ?? 0) > 0;

    return {
        essential,
        traderImage: quest.trader.image4xLink ?? quest.trader.imageLink,
        locationLabel: formatQuestMapSummary(quest, maps),
        hasHeaderMetadata: !!quest.requiredPrestige || !!quest.kappaRequired || !!quest.lightkeeperRequired,
        hasRequirements,
        hasFailureDetails,
        detailColumnCount: Number(hasRequirements) + Number(leadsTo.length > 0) + Number(hasFailureDetails),
        leadsTo,
        traderTierCompletionGates,
        unknownOtherRequirements,
        objectivePresentation: buildObjectivePresentation(quest.objectives),
        visualizerLines: [...branchLines].sort(
            (left, right) => Number(left.kind === "special") - Number(right.kind === "special"),
        ),
        multipleChoiceQuests: multipleChoiceQuestIds.flatMap((id) => questsById.get(id) ?? []),
        mapData: buildQuestDetailMapData(quest, completedObjectiveIds),
    };
}

export function compareRequirementValue(current: number, method: string, required: number) {
    switch (method.trim()) {
        case ">": return current > required;
        case "<": return current < required;
        case "<=": return current <= required;
        case "=":
        case "==":
        case "===": return current === required;
        case "!=":
        case "!==": return current !== required;
        default: return current >= required;
    }
}

export function isTaskRequirementSatisfied(statuses: string[], completed: boolean, failed: boolean) {
    const normalized = statuses.map((status) => status.trim().toLowerCase());
    if (normalized.some((status) => status === "success" || status === "complete" || status === "completed")) return completed;
    if (normalized.some((status) => status === "fail" || status === "failed")) return failed;
    if (normalized.includes("active")) return completed || failed;
    return completed;
}

export function formatOtherRequirementDetails(requirement: QuestOtherRequirement) {
    const knownKeys = new Set(["id", "type", "requirementType"]);
    return Object.entries(requirement)
        .filter(([key, value]) => !knownKeys.has(key) && value != null)
        .map(([key, value]) => `${humanize(key)}: ${formatUnknownValue(value)}`)
        .join(" · ");
}

export function humanize(value: string) {
    return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/^./, (character) => character.toUpperCase());
}

function formatUnknownValue(value: unknown): string {
    if (Array.isArray(value)) return value.map(formatUnknownValue).join(", ");
    if (typeof value === "object" && value !== null) return Object.entries(value).map(([key, nested]) => `${humanize(key)} ${formatUnknownValue(nested)}`).join(", ");
    return String(value);
}
