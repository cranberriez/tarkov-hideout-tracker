import snapshot from "./data/season-1-battle-pass.json";
import locationSummary from "./data/season-1-document-locations.json";
import mapSnapshot from "./data/battle-pass-map-data.json";
import backgrounds from "./data/battle-pass-map-backgrounds.json";
import imagePaths from "./data/battle-pass-map-images.json";
import { documentItemIds } from "../features/battle-pass/lib/battle-pass-inventory";
import { documentLocationArtwork } from "../features/battle-pass/lib/battle-pass-document-artwork";
import { documentMarks, mapOrder, tileSpans } from "../features/battle-pass/lib/battle-pass-display";
import type { SeasonId } from "./cfg/seasons";
import type { PassPage } from "../features/battle-pass/lib/battle-pass-model";
import type { BattlePassDocumentMap, BattlePassDocumentLocation, BattlePassMapSource } from "./battle-pass-map-data";
function createData(seasonId: SeasonId) {
	const pass = structuredClone(snapshot.battlePass);
	const pages: PassPage[] = pass.pages.map((page) => ({
		...page,
		cells: page.cells.map((tile) => ({
			...tile,
			id: tile.id.replace("season-1", seasonId),
			cost: Object.fromEntries(Object.entries(tile.cost).filter(([, count]) => typeof count === "number")),
		})),
	}));
	const summary = structuredClone(locationSummary);
	return {
		seasonId,
		placeholder: seasonId === "season-2",
		notice:
			seasonId === "season-2"
				? "Test placeholder: rewards, documents and locations currently copy Season 1. Test progress is saved separately."
				: null,
		storageKey: "tarkov-battle-pass-" + seasonId + "-v1",
		pages,
		tiles: pages.flatMap((page) => page.cells),
		documents: pass.documents,
		documentKeys: pass.documents.map((doc) => doc.key),
		documentItemIds: { ...documentItemIds },
		documentLocationArtwork: structuredClone(documentLocationArtwork),
		documentMarks: structuredClone(documentMarks),
		mapOrder: [...mapOrder],
		tileSpans: Object.fromEntries(
			Object.entries(tileSpans).map(([id, span]) => [id.replace("season-1", seasonId), span]),
		),
		mapThumbnails: Object.fromEntries(
			mapSnapshot.maps.map((map) => [map.slug, `/images/battle-pass/maps/${map.slug}.webp`]),
		),
		locations: summary,
		mapNames: summary.mapsByDocumentKey as Record<string, string[]>,
		documentMaps: structuredClone(mapSnapshot.maps) as BattlePassDocumentMap[],
		documentLocations: structuredClone(mapSnapshot.locations) as BattlePassDocumentLocation[],
		mapSource: structuredClone(mapSnapshot.source) as BattlePassMapSource,
		backgrounds: structuredClone(backgrounds),
		imagePaths: { ...imagePaths } as Record<string, string>,
	};
}
export type BattlePassData = ReturnType<typeof createData>;
export const BATTLE_PASS_DATA: Record<SeasonId, BattlePassData> = {
	"season-1": createData("season-1"),
	"season-2": createData("season-2"),
};
export function getBattlePassData(seasonId: SeasonId): BattlePassData {
	return BATTLE_PASS_DATA[seasonId];
}
