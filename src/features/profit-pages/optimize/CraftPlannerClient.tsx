"use client";

import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { DataLoadError } from "@/components/core/DataLoadError";
import { useUserStore } from "@/lib/stores/useUserStore";
import { isTrackedCraft } from "@/lib/price-calculation/craft-rules";
import type { ProfitPageData } from "@/types/contracts";
import { useProfitOptions } from "../useProfitOptions";
import { useManualPriceOverrides } from "../useManualPriceOverrides";
import { StationBoard } from "./StationBoard";

/** Loads the shared pricing inputs for the persistent station board. */
export function CraftPlannerClient({ data }: { data: ProfitPageData }) {
	const profile = useUserStore(
		useShallow((state) => ({
			gameMode: state.gameMode,
			playerLevel: state.playerLevel,
			stationLevels: state.stationLevels,
			completedQuests: state.completedQuests,
			traderLoyaltyLevels: state.questTraderLoyaltyLevels,
		})),
	);
	const { craftingSkillLevel, hideoutManagementSkillLevel, useTraderSaleForLockedOutputs, ignorePlayerLevel } =
		useProfitOptions(profile.gameMode);
	const { overrides, setItemOverride } = useManualPriceOverrides(profile.gameMode);
	const itemsById = useMemo(() => Object.fromEntries((data.items ?? []).map((item) => [item.id, item])), [data.items]);
	const stations = useMemo(
		() => Object.fromEntries(data.stations.map((station) => [station.id, station])),
		[data.stations],
	);
	const traders = useMemo(() => Object.fromEntries(data.traders.map((trader) => [trader.id, trader])), [data.traders]);
	const crafts = useMemo(() => data.crafts.filter(isTrackedCraft), [data.crafts]);
	const input = useMemo(
		() => ({
			...profile,
			playerLevel: ignorePlayerLevel ? undefined : profile.playerLevel,
			itemsById,
			crafts,
			barters: data.barters,
			craftingSkillLevel,
			hideoutManagementSkillLevel,
			useTraderSaleForLockedOutputs,
			overrides,
		}),
		[
			profile,
			ignorePlayerLevel,
			itemsById,
			crafts,
			data.barters,
			craftingSkillLevel,
			hideoutManagementSkillLevel,
			useTraderSaleForLockedOutputs,
			overrides,
		],
	);
	const errors = [
		data.errors.items,
		data.errors.prices,
		data.errors.crafts,
		data.errors.barters,
		!data.items ? "Item prices could not be loaded." : null,
	].filter((error): error is string => Boolean(error));
	return (
		<main className="container mx-auto px-4 py-8 sm:px-6">
			{errors.length ? (
				<DataLoadError title="Craft planner data is unavailable" messages={errors} />
			) : (
				<>
					<StationBoard
						key={profile.gameMode}
						input={input}
						gameMode={profile.gameMode}
						stations={stations}
						traders={traders}
						onPriceChange={setItemOverride}
					/>
				</>
			)}
		</main>
	);
}
