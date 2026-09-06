"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    readActiveGameModeCookie,
    serializeActiveGameModeCookie,
    type GameMode,
} from "@/lib/game-mode";
import { useUserStore } from "@/lib/stores/useUserStore";

/** Keep server-selected datasets aligned with the hydrated local player profile. */
export function ActiveGameModeSync() {
    const gameMode = useUserStore((state) => state.gameMode);
    const router = useRouter();

    useEffect(() => {
        function syncServerMode(mode: GameMode) {
            if (readActiveGameModeCookie(document.cookie) === mode) return;
            document.cookie = serializeActiveGameModeCookie(mode);
            router.refresh();
        }

        if (useUserStore.persist.hasHydrated()) {
            // Hydration can finish before this effect runs while the render still
            // holds the server's default PVP snapshot. Read the hydrated owner,
            // otherwise PVP/KORD cookie writes can repeatedly refresh a 404.
            syncServerMode(useUserStore.getState().gameMode);
            return;
        }

        return useUserStore.persist.onFinishHydration((state) => {
            syncServerMode(state.gameMode);
        });
    }, [gameMode, router]);

    return null;
}
