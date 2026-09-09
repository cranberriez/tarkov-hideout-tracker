import type { GameMode } from "@/lib/stores/useUserStore";

/** Stable identity colors for the PVE, PVP, and KORD seasonal profiles. */
export const PROFILE_BASE_COLORS: Record<GameMode, string> = {
    PVE: "#60a5fa",
    PVP: "#ef4444",
    KORD: "#fbbf24",
};
