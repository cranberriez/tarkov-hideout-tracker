export const CACHE_VERSIONS = {
	hideoutStations: 6,
	hideoutItems: 4,
	quests: 5,
	questsFull: 13,
	traders: 1,
} as const;

// Keep the last known-good progression datasets until Tarkov 1.1 support has
// been verified. This does not affect the independently refreshed price cache.
export const PROGRESSION_DATA_FROZEN = true;
