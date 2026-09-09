"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/lib/stores/useUserStore";
import { toTarkovJsonGameMode } from "@/lib/game-mode";
import type { TarkovDataMode } from "@/types/common";
import type { ItemSummary } from "@/types/items";

import { loadDeferredPrices, PriceReleaseChangedError, type PriceState } from "./deferred-prices";
const pending: PriceState = { state: "pending", prices: {} };
const Context = createContext<PriceState | null>(null);

export function DeferredPriceBoundary({ mode, releaseId, itemIds, children }: {
    mode: TarkovDataMode; releaseId: string; itemIds: string[]; children: ReactNode;
}) {
    const router = useRouter();
    const activeMode = useUserStore((state) => state.gameMode);
    const idsKey = [...new Set(itemIds)].sort().join(",");
    const key = `${mode}:${releaseId}:${idsKey}`;
    const [result, setResult] = useState<{ key: string; value: PriceState } | null>(null);
    const [attempt, setAttempt] = useState(0);
    const matchesMode = toTarkovJsonGameMode(activeMode) === mode;
    useEffect(() => {
        if (!matchesMode) return;
        let current = true;
        loadDeferredPrices(key, mode, releaseId, idsKey ? idsKey.split(",") : []).then(
            (value) => { if (current) setResult({ key, value }); },
            (error) => { if (current) setResult({ key, value: { state: "error", prices: {}, releaseChanged: error instanceof PriceReleaseChangedError } }); },
        );
        return () => { current = false; };
    }, [key, mode, releaseId, idsKey, matchesMode, attempt]);
    const value = matchesMode && result?.key === key ? result.value : pending;
    return <Context.Provider value={value}>
        {itemIds.length > 0 && value.state !== "ready" && <div role="status" className="fixed bottom-4 right-4 z-40 rounded border border-highlight/10 bg-card px-4 py-2 text-xs text-muted-foreground shadow-lg">
            {value.state === "pending" ? "Loading item prices…" : value.releaseChanged ? <>The data release changed. <button type="button" className="underline" onClick={() => router.refresh()}>Refresh page</button></> : <>Item prices could not be loaded. <button type="button" className="underline" onClick={() => { setResult(null); setAttempt((value) => value + 1); }}>Retry prices</button></>}
        </div>}
        {children}
    </Context.Provider>;
}

export function useDeferredPriceItems(items: ItemSummary[] | null) {
    const delivery = useContext(Context);
    return useMemo(() => !delivery ? items : items?.map((item) => ({
        ...item, marketPrice: delivery.prices[item.id] ?? null, priceLoadState: delivery.state,
    })) ?? null, [items, delivery]);
}
