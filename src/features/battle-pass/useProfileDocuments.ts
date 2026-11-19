"use client";

import { useMemo } from "react";
import { getSeason } from "@/lib/cfg/seasons";
import { PROFILE_BASE_COLORS } from "@/lib/cfg/profile-colors";
import { useUserStore } from "@/lib/stores/useUserStore";
import { profileDocumentCounts } from "./lib/battle-pass-inventory";
import { useBattlePassData } from "./BattlePassSeason";

const EMPTY_COUNTS = {};

/** Read-only ordinary document totals for PVE, PVP and this pass's seasonal character, in that display order. */
export function useProfileDocuments() {
	const data = useBattlePassData();
	const pvp = useUserStore((state) => state.profiles.PVP.itemCounts);
	const pve = useUserStore((state) => state.profiles.PVE.itemCounts);
	const seasonal = useUserStore((state) => state.seasonalProfiles[data.seasonId]?.itemCounts ?? EMPTY_COUNTS);
	return useMemo(() => {
		const season = getSeason(data.seasonId);
		const profiles = [
			{ key: "PVE", label: "PVE", color: PROFILE_BASE_COLORS.PVE, counts: pve },
			{ key: "PVP", label: "PVP", color: PROFILE_BASE_COLORS.PVP, counts: pvp },
			{ key: data.seasonId, label: season.name, color: season.color, counts: seasonal },
		].map(({ counts, ...profile }) => ({
			...profile,
			inventory: profileDocumentCounts(counts, data.documentItemIds),
		}));
		return { profiles };
	}, [pvp, pve, seasonal, data]);
}
export type ProfileDocuments = ReturnType<typeof useProfileDocuments>;
