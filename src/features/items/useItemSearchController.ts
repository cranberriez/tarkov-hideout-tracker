"use client";

import { useEffect, useState } from "react";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import type { ItemSearchPayload } from "@/types/contracts";
import type { ItemSummary } from "@/types/items";

const SEARCH_DEBOUNCE_MS = 200;

type SearchState =
    | { requestKey: string; status: "success"; items: ItemSummary[]; error: null }
    | { requestKey: string; status: "error"; items: ItemSummary[]; error: string }
    | null;

export function useItemSearchController({
    enabled,
    mode,
    query,
}: {
    enabled: boolean;
    mode: TarkovJsonGameMode;
    query: string;
}) {
    const [state, setState] = useState<SearchState>(null);
    const trimmedQuery = query.trim();
    const requestKey = enabled && trimmedQuery ? `${mode}:${trimmedQuery}` : null;

    useEffect(() => {
        if (!enabled || !trimmedQuery) {
            return;
        }

        const controller = new AbortController();
        const activeRequestKey = `${mode}:${trimmedQuery}`;
        const timer = window.setTimeout(() => {
            const params = new URLSearchParams({ mode, q: trimmedQuery });
            fetch(`/api/items/search?${params}`, { signal: controller.signal })
                .then(async (response) => {
                    if (!response.ok) {
                        throw new Error("Item search is temporarily unavailable.");
                    }
                    return (await response.json()) as ItemSearchPayload;
                })
                .then((payload) => {
                    setState({
                        requestKey: activeRequestKey,
                        status: "success",
                        items: payload.items,
                        error: null,
                    });
                })
                .catch((reason: unknown) => {
                    if (controller.signal.aborted) return;
                    setState({
                        requestKey: activeRequestKey,
                        status: "error",
                        items: [],
                        error:
                            reason instanceof Error
                                ? reason.message
                                : "Item search could not be loaded.",
                    });
                });
        }, SEARCH_DEBOUNCE_MS);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [enabled, mode, trimmedQuery]);

    const isSettled = requestKey !== null && state?.requestKey === requestKey;
    const items = isSettled && state?.status === "success" ? state.items : [];

    return {
        items,
        isLoading: requestKey !== null && !isSettled,
        error: isSettled && state?.status === "error" ? state.error : null,
        hasNoResults:
            isSettled && state?.status === "success" && state.items.length === 0,
    };
}
