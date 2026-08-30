export const CACHE_VERSIONS = {
	hideoutStations: 7,
	itemCatalog: 3,
	itemBarters: 1,
	itemCrafts: 1,
	quests: 6,
	questsFull: 14,
	traders: 1,
} as const;

// Emergency switch for pinning the last known-good progression datasets.
// Normal production behavior uses the shared time-based freshness window.
export const PROGRESSION_DATA_FROZEN = false;
