"use client";

import { useEffect, useState } from "react";
import type { GameMode } from "@/lib/game-mode";
import type { ManualPriceOverride, ManualPriceOverrides } from "@/lib/price-calculation";

const STORAGE_PREFIX = "tarkov-profit-price-overrides-v1";

function isPriceOverride(value: unknown): value is ManualPriceOverride {
    if (!value || typeof value !== "object") return false;
    const override = value as ManualPriceOverride;
    return (
        (override.buy === undefined || (Number.isFinite(override.buy) && override.buy >= 0)) &&
        (override.sell === undefined || (Number.isFinite(override.sell) && override.sell >= 0))
    );
}

function readOverrides(gameMode: GameMode): ManualPriceOverrides {
    try {
        const raw = window.localStorage.getItem(`${STORAGE_PREFIX}:${gameMode}`);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== "object") return {};
        return Object.fromEntries(
            Object.entries(parsed).filter(([, value]) => isPriceOverride(value)),
        );
    } catch {
        return {};
    }
}

export function useManualPriceOverrides(gameMode: GameMode) {
    const [overrides, setOverrides] = useState<ManualPriceOverrides>({});
    const [loadedMode, setLoadedMode] = useState<GameMode | null>(null);

    useEffect(() => {
        setOverrides(readOverrides(gameMode));
        setLoadedMode(gameMode);
    }, [gameMode]);

    useEffect(() => {
        if (loadedMode !== gameMode) return;
        try {
            window.localStorage.setItem(
                `${STORAGE_PREFIX}:${gameMode}`,
                JSON.stringify(overrides),
            );
        } catch {
            // Calculations still work for this visit when browser storage is unavailable.
        }
    }, [gameMode, loadedMode, overrides]);

    function setItemOverride(itemId: string, override: ManualPriceOverride) {
        setOverrides((current) => {
            const next = { ...current };
            if (override.buy === undefined && override.sell === undefined) delete next[itemId];
            else next[itemId] = override;
            return next;
        });
    }

    return { overrides, setItemOverride };
}
