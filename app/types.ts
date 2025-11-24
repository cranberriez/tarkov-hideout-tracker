// Shared types for Hideout Tracker API and client state

export interface RequirementAttribute {
    type: string;
    name: string;
    value: string;
}

export interface HideoutItem {
    id: string;
    name: string;
    shortName?: string;
    iconLink?: string;
    gridImageLink?: string;
}

export interface ItemRequirement {
    id: string;
    item: HideoutItem;
    count?: number;
    quantity?: number;
    attributes: RequirementAttribute[];
}

export interface StationLevelRequirement {
    station: {
        normalizedName: string;
    };
    level: number;
}

export interface SkillRequirement {
    name: string;
    skill: {
        name: string;
        imageLink?: string;
    };
    level: number;
}

export interface TraderRequirement {
    trader: {
        name: string;
        normalizedName: string;
        imageLink?: string;
    };
    value: number;
}

export interface StationLevel {
    id: string;
    level: number;
    itemRequirements: ItemRequirement[];
    stationLevelRequirements: StationLevelRequirement[];
    skillRequirements: SkillRequirement[];
    traderRequirements: TraderRequirement[];
}

export interface Station {
    id: string;
    name: string;
    normalizedName: string;
    imageLink?: string;
    levels: StationLevel[];
}

export interface HideoutStationsPayload {
    stations: Station[];
}

export interface ItemPrice {
    id: string;
    name: string;
    shortName?: string;
    iconLink?: string;
    gridImageLink?: string;
    avg24hPrice?: number;
    basePrice?: number;
    lastLowPrice?: number;
}

export interface ItemsPricesPayload {
    // itemId -> price info
    [itemId: string]: ItemPrice;
}

export interface TimedResponse<TPayload> {
    data: TPayload;
    updatedAt: number; // ms since epoch
}
