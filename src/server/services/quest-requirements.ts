import type { QuestOtherRequirement } from "@/types/quests";

export interface RawQuestOtherRequirement {
    id?: string | null;
    type: string;
    requirementType?: string | null;
    compareMethod?: string | null;
    value?: number | string | boolean | null;
    [key: string]: unknown;
}

/** Preserve opaque JSON progression gates without assigning runtime meaning. */
export function mapQuestOtherRequirements(
    requirements: RawQuestOtherRequirement[] | undefined,
): QuestOtherRequirement[] {
    return (requirements ?? []).map((requirement) => ({ ...requirement }));
}
