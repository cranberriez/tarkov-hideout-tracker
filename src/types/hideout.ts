export interface GlobalSkill {
	id: string;
	name: string;
	imageLink?: string;
}

export interface ItemRequirement {
	id: string;
	itemId: string;
	count: number;
	isFir: boolean;
	isTool: boolean;
}

export interface StationLevelRequirement {
	station: { normalizedName: string };
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

/**
 * Validated provider bonuses the app models; the adapter drops other types. Each level's
 * bonuses stack with lower built levels (Bitcoin Farm slots 10 + 15 + 25 = 50).
 */
export type StationBonus =
	| { type: "AdditionalSlots"; value: number; slotItemIds: string[] }
	| { type: "FuelConsumption"; value: number };

export interface StationLevel {
	id: string;
	level: number;
	constructionTime: number;
	itemRequirements: ItemRequirement[];
	stationLevelRequirements: StationLevelRequirement[];
	skillRequirements: SkillRequirement[];
	traderRequirements: TraderRequirement[];
	/** Absent until the catalog is refreshed after migration 0004. */
	bonuses?: StationBonus[];
}

export interface Station {
	id: string;
	name: string;
	normalizedName: string;
	imageLink?: string;
	levels: StationLevel[];
}
