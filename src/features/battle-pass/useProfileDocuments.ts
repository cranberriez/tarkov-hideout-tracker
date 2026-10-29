"use client";

import { useMemo } from "react";
import { getSeason } from "@/lib/cfg/seasons";
import { PROFILE_BASE_COLORS } from "@/lib/cfg/profile-colors";
import { useUserStore } from "@/lib/stores/useUserStore";
import { profileDocumentCounts } from "./lib/battle-pass-inventory";
import { useBattlePassData } from "./BattlePassSeason";

const EMPTY_COUNTS = {};

/** Read-only ordinary document totals for PVP, PVE and this pass's seasonal character. */
export function useProfileDocuments() {
	const data = useBattlePassData();
	const pvp = useUserStore((state) => state.profiles.PVP.itemCounts);
	const pve = useUserStore((state) => state.profiles.PVE.itemCounts);
	const seasonal = useUserStore((state) => state.seasonalProfiles[data.seasonId]?.itemCounts ?? EMPTY_COUNTS);
	return useMemo(() => {
		const season = getSeason(data.seasonId);
		const profiles = [
			{ key: "PVP", label: "PVP", color: PROFILE_BASE_COLORS.PVP, counts: pvp },
			{ key: "PVE", label: "PVE", color: PROFILE_BASE_COLORS.PVE, counts: pve },
			{ key: data.seasonId, label: season.name, color: season.color, counts: seasonal },
		].map(({ counts, ...profile }) => ({
			...profile,
			inventory: profileDocumentCounts(counts, data.documentItemIds),
		}));
		const total: Record<string, number> = {};
		for (const profile of profiles)
			for (const [key, amount] of Object.entries(profile.inventory)) total[key] = (total[key] ?? 0) + amount;
		return { profiles, total };
	}, [pvp, pve, seasonal, data]);
}
export type ProfileDocuments = ReturnType<typeof useProfileDocuments>;
