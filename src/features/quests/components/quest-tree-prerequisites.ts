export interface ShouldFoldLinkedPrerequisitesInput {
    completed: boolean;
    ignored: boolean;
    prerequisiteIds: string[];
}

export type LinkedPrerequisiteStatus = "available" | "locked" | "completed";

export interface LinkedPrerequisiteItem {
    id: string;
    status: LinkedPrerequisiteStatus;
}

export interface PartitionLinkedPrerequisitesInput {
    completed: boolean;
    ignored: boolean;
    linkedPrerequisites: LinkedPrerequisiteItem[];
}

const linkedPrerequisiteStatusOrder: Record<LinkedPrerequisiteStatus, number> = {
    available: 0,
    locked: 1,
    completed: 2,
};

export function shouldFoldLinkedPrerequisites({
    completed,
    ignored,
    prerequisiteIds,
}: ShouldFoldLinkedPrerequisitesInput): boolean {
    if (ignored) return true;
    if (!completed) return false;
    return prerequisiteIds.length > 0;
}

export function partitionLinkedPrerequisites({
    completed,
    ignored,
    linkedPrerequisites,
}: PartitionLinkedPrerequisitesInput): {
    expanded: LinkedPrerequisiteItem[];
    folded: LinkedPrerequisiteItem[];
} {
    const sorted = [...linkedPrerequisites].sort(
        (a, b) => linkedPrerequisiteStatusOrder[a.status] - linkedPrerequisiteStatusOrder[b.status],
    );

    if (ignored) {
        return { expanded: [], folded: sorted };
    }

    if (!completed) {
        return { expanded: sorted, folded: [] };
    }

    return {
        expanded: sorted.filter((item) => item.status !== "completed"),
        folded: sorted.filter((item) => item.status === "completed"),
    };
}
