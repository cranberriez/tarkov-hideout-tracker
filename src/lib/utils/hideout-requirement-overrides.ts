import type { TarkovJsonGameMode } from "@/lib/game-mode";

interface HideoutRequirementValues {
    gameMode: TarkovJsonGameMode;
    upstreamCount: number;
    upstreamFoundInRaid: boolean;
    reviewedQuantity?: number;
    reviewedFoundInRaid?: boolean;
    fallbackFoundInRaid: boolean;
}

export function usesReviewedHideoutOverrides(gameMode: TarkovJsonGameMode) {
    return gameMode !== "pvp-season";
}

/** Seasonal hideout rules are distinct and must remain authoritative. */
export function resolveHideoutRequirementValues({
    gameMode,
    upstreamCount,
    upstreamFoundInRaid,
    reviewedQuantity,
    reviewedFoundInRaid,
    fallbackFoundInRaid,
}: HideoutRequirementValues) {
    if (!usesReviewedHideoutOverrides(gameMode)) {
        return { count: upstreamCount, isFir: upstreamFoundInRaid };
    }

    return {
        count: reviewedQuantity ?? upstreamCount,
        isFir:
            upstreamFoundInRaid ||
            (reviewedFoundInRaid ?? fallbackFoundInRaid),
    };
}
