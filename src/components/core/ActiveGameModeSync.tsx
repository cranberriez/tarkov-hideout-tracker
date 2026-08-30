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
            syncServerMode(gameMode);
            return;
        }

        return useUserStore.persist.onFinishHydration((state) => {
            syncServerMode(state.gameMode);
        });
    }, [gameMode, router]);

    return null;
}
