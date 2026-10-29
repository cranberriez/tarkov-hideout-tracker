"use client";

import { usePathname, useRouter } from "next/navigation";
import { isMapExplorerMapKey } from "@/lib/cfg/map-explorer";
import type { RaidNoticeMap } from "@/lib/stores/useCompanionSyncStore";
import { useUserStore } from "@/lib/stores/useUserStore";
import { canSwitchToProfile, switchToProfile } from "./companion-actions";
import { activeProfileKey, describeProfile, type ProfileKey } from "./sync-model";

/**
 * The one press that takes the player to their raid: switches to the raid's profile when it differs, then opens its
 * map unless that map is already showing. Nothing happens before `go` is called.
 */
export function useRaidMapAction(profile: ProfileKey | null, map: RaidNoticeMap | null, onDone?: () => void) {
	const router = useRouter();
	const pathname = usePathname();
	const gameMode = useUserStore((state) => state.gameMode);
	const selectedSeasonId = useUserStore((state) => state.selectedSeasonId);

	const mapKey = map?.normalizedName && isMapExplorerMapKey(map.normalizedName) ? map.normalizedName : null;
	const mapHref = mapKey ? `/maps/${mapKey}` : null;
	const target = profile && profile !== activeProfileKey(gameMode, selectedSeasonId) ? profile : null;
	const needsMap = !!mapHref && pathname !== mapHref;
	const profileLabel = profile ? describeProfile(profile) : null;
	/** A different profile that can't be switched to (a KORD season that isn't activated). */
	const blocked = target !== null && !canSwitchToProfile(target);

	let label: string | null = null;
	if (target && needsMap) label = `Switch to ${profileLabel} & go to map`;
	else if (needsMap) label = "Go to map";
	else if (target) label = `Switch to ${profileLabel}`;

	const go = () => {
		if (target && !switchToProfile(target)) return;
		if (needsMap) router.push(mapHref);
		onDone?.();
	};

	return { label: blocked ? null : label, blocked, profileLabel, go };
}
