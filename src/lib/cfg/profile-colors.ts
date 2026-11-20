import type { GameMode } from "@/lib/stores/useUserStore";

/** Stable identity colors for the PVE, PVP, and KORD seasonal profiles. */
export const PROFILE_BASE_COLORS: Record<GameMode, string> = {
	PVE: "#60a5fa",
	PVP: "#ef4444",
	KORD: "#fbbf24",
};

/** Season 2 (UNTAR): deeper than the logo blue so it stays distinct from the PVE sky blue. */
export const SEASON_2_COLOR = "#2b78d9";
