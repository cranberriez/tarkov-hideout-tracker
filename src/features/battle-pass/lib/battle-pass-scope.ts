import type { SeasonId } from "../../../lib/cfg/seasons";
import type { PlayerItemCounts } from "./battle-pass-inventory";
export type BattlePassInventoryScope = {
	mode: string;
	selectedSeasonId: SeasonId;
	seasonId: SeasonId;
	seasonal: boolean;
};
export function inventoryScopeIsCurrent(
	scope: BattlePassInventoryScope,
	state: { gameMode: string; selectedSeasonId: SeasonId },
) {
	return state.gameMode === scope.mode && state.selectedSeasonId === scope.selectedSeasonId;
}
export function battlePassInventoryCounts(
	scope: BattlePassInventoryScope,
	state: { itemCounts: PlayerItemCounts; seasonalProfiles: Record<string, { itemCounts: PlayerItemCounts }> },
): PlayerItemCounts {
	return scope.seasonal ? (state.seasonalProfiles[scope.seasonId]?.itemCounts ?? {}) : state.itemCounts;
}
