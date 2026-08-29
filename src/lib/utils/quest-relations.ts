export type QuestRelationTiming = "complete" | "active" | "failed" | "resolved";

export function getQuestRelationTiming(statuses: readonly string[]): QuestRelationTiming {
    const normalized = statuses.map((status) => status.trim().toLowerCase());

    if (normalized.includes("active")) return "active";
    if (normalized.includes("complete") && normalized.includes("failed")) return "resolved";
    if (normalized.includes("failed")) return "failed";
    return "complete";
}

export function formatQuestUnlockTiming(statuses: readonly string[]) {
    switch (getQuestRelationTiming(statuses)) {
        case "active":
            return "On accept";
        case "failed":
            return "On fail";
        case "resolved":
            return "On complete or fail";
        default:
            return "On complete";
    }
}
