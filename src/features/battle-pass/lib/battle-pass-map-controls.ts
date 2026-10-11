import type {
	BattlePassDocumentLocation,
	BattlePassDocumentMap,
	BattlePassDocumentKey,
} from "@/lib/battle-pass-map-data";

export const locationFloorKey = (location: Pick<BattlePassDocumentLocation, "floor">) => location.floor ?? "unknown";

export function documentFloorOptions(map: BattlePassDocumentMap | undefined, locations: BattlePassDocumentLocation[]) {
	const options = map?.floors.map(({ id, name }) => ({ id, name })) ?? [];
	for (const location of locations) {
		const id = locationFloorKey(location);
		if (!options.some((option) => option.id === id))
			options.push({ id, name: id === "unknown" ? "Unspecified floor" : id });
	}
	return options;
}

export function filterDocumentLocations(
	locations: BattlePassDocumentLocation[],
	hiddenFloors: string[],
	hiddenTypes: string[],
) {
	return locations.filter(
		(location) => !hiddenFloors.includes(locationFloorKey(location)) && !hiddenTypes.includes(location.documentKey),
	);
}

export function documentMapCounts(map: BattlePassDocumentMap, locations: BattlePassDocumentLocation[], key: string) {
	return {
		possibleSpots: locations.filter((location) => location.documentKey === key).length,
		raidSpawns: map.spawns[key as BattlePassDocumentKey],
	};
}
