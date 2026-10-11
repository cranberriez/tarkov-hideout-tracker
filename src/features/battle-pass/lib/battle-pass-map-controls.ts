import type {
	BattlePassDocumentLocation,
	BattlePassDocumentMap,
	BattlePassDocumentKey,
} from "@/lib/battle-pass-map-data";

export function filterDocumentLocations(locations: BattlePassDocumentLocation[], hiddenTypes: string[]) {
	return locations.filter((location) => !hiddenTypes.includes(location.documentKey));
}

export function documentMapCounts(map: BattlePassDocumentMap, locations: BattlePassDocumentLocation[], key: string) {
	return {
		possibleSpots: locations.filter((location) => location.documentKey === key).length,
		raidSpawns: map.spawns[key as BattlePassDocumentKey],
	};
}
