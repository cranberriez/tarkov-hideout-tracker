import type { Station } from "@/types/hideout";
import type { ItemSummary } from "@/types/items";

export interface BaseItemRequirementsProps {
    nextLevelData: Station["levels"][number];
    hideMoney: boolean;
    completedRequirements: Record<string, boolean>;
    toggleRequirement: (requirementId: string) => void;
    pooledFirByItem: Record<string, number>;
    itemById: Readonly<Record<string, ItemSummary>>;
}
