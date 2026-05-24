import type { ReactNode } from "react";

export interface QuestRef {
    id: string;
    name: string;
    trader: { imageLink: string | null; image4xLink: string | null; name: string };
    prerequisiteType?: "complete" | "active" | "failed" | "resolved";
}

export interface QuestSortMetadata {
    key: string;
    label: string;
    title?: string;
}

export interface QuestChipData {
    key: string;
    className: string;
    label: ReactNode;
}

