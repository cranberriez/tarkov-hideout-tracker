export const CACHE_VERSIONS = {
	hideoutStations: 9,
	itemCatalog: 4,
	itemBarters: 2,
	itemCrafts: 2,
	quests: 7,
	questsFull: 15,
	traders: 2,
} as const;

// Emergency switch for pinning the last known-good progression datasets.
// Normal production behavior uses the shared time-based freshness window.
export const PROGRESSION_DATA_FROZEN = false;
