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

export interface StationLevel {
    id: string;
    level: number;
    itemRequirements: ItemRequirement[];
}

export interface Station {
    id: string;
    name: string;
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
