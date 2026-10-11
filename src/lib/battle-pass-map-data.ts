import source from "./data/battle-pass-map-data.json";

export type BattlePassDocumentKey =
	"financial" | "personnel" | "project" | "blueprints" | "test" | "user" | "medical" | "technical";

export type BattlePassDocumentMapLayer = {
	id: string;
	name: string;
	imageUrl: string;
	width: number;
	height: number;
};

export type BattlePassDocumentFloor = {
	id: string;
	name: string;
	short?: string;
	layer: string;
};

export type BattlePassDocumentMap = {
	id: string;
	name: string;
	slug: string;
	imageUrl: string;
	width: number;
	height: number;
	layers: BattlePassDocumentMapLayer[];
	floors: BattlePassDocumentFloor[];
	spawns: Partial<Record<BattlePassDocumentKey, number>>;
	total: number;
	sourceUrl: string;
	license: string;
	attribution: string;
};

export type BattlePassDocumentLocation = {
	id: string;
	mapId: string;
	documentKey: BattlePassDocumentKey;
	x: number;
	y: number;
	floor: string | null;
	layer: string;
	title: string;
	description: string | null;
	key: string | null;
	screenshotUrls: string[];
	verified: boolean;
	sourceId: string;
	sourceUrl: string | null;
};

export type BattlePassMapSource = {
	name: string;
	url: string;
	season: string;
	attribution: string;
	license: string;
	coordinates: string;
	crossCheck: {
		name: string;
		url: string;
		license: string;
		note: string;
	};
};

export const battlePassMapSource = source.source as BattlePassMapSource;
export const documentMaps = source.maps as BattlePassDocumentMap[];
export const documentLocations = source.locations as BattlePassDocumentLocation[];
