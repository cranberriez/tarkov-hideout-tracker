export interface ItemAmountRef {
    itemId: string;
    count: number;
    isTool?: boolean;
}

export interface BarterRecord {
    id: string;
    offeredItemId: string;
    offeredCount: number;
    traderId: string;
    minTraderLevel: number;
    taskUnlockId?: string;
    requiredItems: ItemAmountRef[];
    buyLimit?: number | null;
}

export interface CraftRecord {
    id: string;
    productItemId: string;
    productCount: number;
    stationId: string;
    level: number;
    duration: number;
    taskUnlockId?: string;
    requiredItems: ItemAmountRef[];
    requiredQuestItems: ItemAmountRef[];
    gameEditions: string[];
}
