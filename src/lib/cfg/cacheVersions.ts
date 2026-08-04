export const CACHE_VERSIONS = {
	hideoutStations: 6,
	hideoutItems: 2,
	marketPrices: 3,
	quests: 4,
	questsFull: 7,
	traders: 1,
} as const;

// Keep the last known-good progression datasets until Tarkov 1.1 support has
// been verified. This does not affect the independently refreshed price cache.
export const PROGRESSION_DATA_FROZEN = true;
