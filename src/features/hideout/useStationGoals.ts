"use client";

import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useUserStore } from "@/lib/stores/useUserStore";
import { resolveStationGoals, stationGoalCaps } from "@/lib/utils/station-goals";
import type { Station } from "@/types/hideout";

/** The active profile's goals resolved against `stations`; `ignore` drops the caps. */
export function useStationGoals(stations: readonly Station[], { ignore = false }: { ignore?: boolean } = {}) {
	const { stationLevels, stationGoals } = useUserStore(
		useShallow((state) => ({ stationLevels: state.stationLevels, stationGoals: state.stationGoals })),
	);
	const resolved = useMemo(
		() => resolveStationGoals(stations, stationLevels, stationGoals ?? {}),
		[stations, stationLevels, stationGoals],
	);
	const caps = useMemo(() => (ignore ? undefined : stationGoalCaps(resolved)), [ignore, resolved]);
	return { resolved, caps };
}
