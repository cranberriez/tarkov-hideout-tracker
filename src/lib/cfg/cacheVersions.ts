export const CACHE_VERSIONS = {
	hideoutStations: 6,
	hideoutItems: 4,
	quests: 5,
	questsFull: 13,
	traders: 1,
} as const;

// Emergency switch for pinning the last known-good progression datasets.
// Normal production behavior uses the shared time-based freshness window.
export const PROGRESSION_DATA_FROZEN = false;
