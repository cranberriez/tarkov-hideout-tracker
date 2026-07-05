"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { PriceDataProvider, type PriceDataContextValue } from "@/app/(data)/_priceDataContext";
import { useUserStore, type GameMode } from "@/lib/stores/useUserStore";
import type { MarketPrice, TimedResponse } from "@/types";

// Prices are no longer fetched server-side and embedded in every page's RSC
// payload. They are fetched once per game mode from /api/prices/[mode],
// which is CDN/ISR-cached and invalidated by the daily price cron. The
// active mode loads first; the other mode prefetches in the background so
// the PVP/PVE toggle stays instant. The PriceDataContext interface is
// unchanged, so consumers don't know the difference.

type PriceMap = Record<string, MarketPrice | null>;
type ModeState = PriceDataContextValue["marketPricesByMode"][GameMode];

const EMPTY_MODE_STATE: ModeState = { prices: {}, updatedAt: null };

interface PriceDataLayoutProps {
    children: ReactNode;
}

export default function PriceDataLayout({ children }: PriceDataLayoutProps) {
    const gameMode = useUserStore((state) => state.gameMode);

    const [marketPricesByMode, setMarketPricesByMode] = useState<
        PriceDataContextValue["marketPricesByMode"]
    >({
        PVP: EMPTY_MODE_STATE,
        PVE: EMPTY_MODE_STATE,
    });
    const [loadedModes, setLoadedModes] = useState<Record<GameMode, boolean>>({
        PVP: false,
        PVE: false,
    });

    // Dedupes in-flight requests across renders/mode switches.
    const requestedModes = useRef<Set<GameMode>>(new Set());

    useEffect(() => {
        let cancelled = false;

        async function loadMode(mode: GameMode) {
            if (requestedModes.current.has(mode)) return;
            requestedModes.current.add(mode);

            try {
                const res = await fetch(`/api/prices/${mode.toLowerCase()}`);
                if (!res.ok) {
                    throw new Error(`Failed to load ${mode} prices (${res.status})`);
                }
                const body = (await res.json()) as TimedResponse<PriceMap>;
                if (cancelled) return;

                setMarketPricesByMode((prev) => ({
                    ...prev,
                    [mode]: {
                        prices: body.data ?? {},
                        updatedAt: body.updatedAt || null,
                    },
                }));
                setLoadedModes((prev) => ({ ...prev, [mode]: true }));
            } catch (error) {
                console.error(`Failed to load ${mode} market prices`, error);
                // Allow a retry on the next mount/mode switch.
                requestedModes.current.delete(mode);
            }
        }

        const activeMode: GameMode = gameMode === "PVE" ? "PVE" : "PVP";
        const otherMode: GameMode = activeMode === "PVE" ? "PVP" : "PVE";

        void loadMode(activeMode).then(() => {
            if (!cancelled) void loadMode(otherMode);
        });

        return () => {
            cancelled = true;
        };
    }, [gameMode]);

    const activeMode: GameMode = gameMode === "PVE" ? "PVE" : "PVP";

    const value: PriceDataContextValue = {
        marketPricesByMode,
        loading: !loadedModes[activeMode],
    };

    return <PriceDataProvider value={value}>{children}</PriceDataProvider>;
}
