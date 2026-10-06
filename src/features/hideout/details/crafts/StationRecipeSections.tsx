"use client";

import { GENERATOR_STATION_ID } from "@/lib/cfg/hideout-power";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { BITCOIN_FARM_STATION_ID } from "@/lib/price-calculation";
import { useGameDataEnabled } from "@/lib/query/game-data";
import type { ProfitPageData } from "@/types/contracts";
import { BitcoinFarmPanel } from "../../power/BitcoinFarmPanel";
import { GeneratorFuelSection } from "../../power/GeneratorFuelSection";
import { useStationDetails } from "../StationDetailsContext";
import { StationCraftsSection } from "./StationCraftsSection";

/**
 * Recipe-data sections of the station page: station-specific power panels, then crafts.
 * Power panels read saved levels, so they wait for the profile like crafts do (no hydration mismatch).
 */
export function StationRecipeSections({
	mode,
	fallbackData,
}: {
	mode: TarkovJsonGameMode;
	fallbackData: ProfitPageData | null;
}) {
	const { station } = useStationDetails();
	const enabled = useGameDataEnabled(mode);
	const hasPowerPanel = station.id === BITCOIN_FARM_STATION_ID || station.id === GENERATOR_STATION_ID;
	return (
		<>
			{hasPowerPanel && !enabled && (
				<section aria-busy="true" aria-label="Loading power">
					<div className="mb-3 h-3 w-16 animate-pulse rounded bg-highlight/10" />
					<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
						<div className="h-16 animate-pulse rounded bg-highlight/5" />
						<div className="h-16 animate-pulse rounded bg-highlight/5" />
					</div>
				</section>
			)}
			{enabled && station.id === BITCOIN_FARM_STATION_ID && (
				<BitcoinFarmPanel mode={mode} fallbackData={fallbackData} />
			)}
			{enabled && station.id === GENERATOR_STATION_ID && (
				<GeneratorFuelSection mode={mode} fallbackData={fallbackData} />
			)}
			<StationCraftsSection mode={mode} fallbackData={fallbackData} />
		</>
	);
}
