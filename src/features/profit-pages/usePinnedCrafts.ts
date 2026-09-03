"use client";

import { useEffect, useState } from "react";
import type { GameMode } from "@/lib/game-mode";

const STORAGE_PREFIX = "tarkov-profit-pinned-crafts-v1";

function readPinnedCrafts(gameMode: GameMode): Record<string, true> {
    try {
        const raw = window.localStorage.getItem(`${STORAGE_PREFIX}:${gameMode}`);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return {};
        return Object.fromEntries(
            parsed
                .filter((craftId): craftId is string => typeof craftId === "string")
                .map((craftId) => [craftId, true]),
        );
    } catch {
        return {};
    }
}

export function usePinnedCrafts(gameMode: GameMode) {
    const [pinnedCrafts, setPinnedCrafts] = useState<Record<string, true>>({});
    const [loadedMode, setLoadedMode] = useState<GameMode | null>(null);

    useEffect(() => {
        setPinnedCrafts(readPinnedCrafts(gameMode));
        setLoadedMode(gameMode);
    }, [gameMode]);

    useEffect(() => {
        if (loadedMode !== gameMode) return;
        try {
            window.localStorage.setItem(
                `${STORAGE_PREFIX}:${gameMode}`,
                JSON.stringify(Object.keys(pinnedCrafts)),
            );
        } catch {
            // Pins still work for this visit when browser storage is unavailable.
        }
    }, [gameMode, loadedMode, pinnedCrafts]);

    function togglePinnedCraft(craftId: string) {
        setPinnedCrafts((current) => {
            const next = { ...current };
            if (next[craftId]) delete next[craftId];
            else next[craftId] = true;
            return next;
        });
    }

    return { pinnedCrafts, togglePinnedCraft };
}
