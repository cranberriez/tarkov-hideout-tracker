import type { ItemSummary } from "@/types/items";

export interface ItemAmount {
	item: ItemSummary;
	count: number;
	isTool?: boolean;
}

export interface ItemUnlockQuest {
	id: string;
	name: string;
	wikiLink?: string | null;
}

interface ItemTraderOfferBase {
	id: string;
	trader: {
		id: string;
		name: string;
		normalizedName: string;
		imageLink?: string | null;
	};
	minTraderLevel: number;
	taskUnlock?: ItemUnlockQuest | null;
	offeredCount: number;
	buyLimit?: number | null;
}

export interface ItemBarterOffer extends ItemTraderOfferBase {
	kind: "barter";
	requiredItems: ItemAmount[];
	/** Set for recipes that consume the selected item; otherwise the selected item is the output. */
	outputItem?: ItemSummary;
}

export interface ItemPurchaseOffer extends ItemTraderOfferBase {
	kind: "buy";
	price: number;
	priceRUB: number;
	currency: string;
	requiredItems: [];
}

export type ItemTraderOffer = ItemBarterOffer | ItemPurchaseOffer;

export interface ItemCraftRecipe {
	id: string;
	station: {
		id: string;
		name: string;
		normalizedName: string;
		imageLink?: string;
	};
	level: number;
	duration: number;
	taskUnlock?: ItemUnlockQuest | null;
	requiredItems: ItemAmount[];
	requiredQuestItems: ItemAmount[];
	gameEditions: string[];
	productCount: number;
	/** Set for recipes that consume the selected item; otherwise the selected item is the output. */
	outputItem?: ItemSummary;
}
