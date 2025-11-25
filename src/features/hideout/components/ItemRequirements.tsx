import type { Station } from "@/types";

export interface BaseItemRequirementsProps {
    nextLevelData: Station["levels"][number];
    hideMoney: boolean;
    completedRequirements: Record<string, boolean>;
    toggleRequirement: (requirementId: string) => void;
}
