import hideoutData from "./hideout-data.json";

export interface WikiRequirements {
    name: string;
    normalizedName: string;
    levels: {
        level: number;
        requirements: {
            type: "item" | "station" | "trader" | "skill" | "special";
            name?: string; // Normalized name
            quantity?: number;
            level?: number;
            foundInRaid?: boolean;
            description?: string;
        }[];
        constructionTime: string;
    }[];
}

export const wikiData = hideoutData as WikiRequirements[];
