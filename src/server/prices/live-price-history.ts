import type { TarkovJsonGameMode } from "@/lib/game-mode";
import type { PriceHistoryPoint } from "@/types/prices";
import { normalizePriceHistory } from "../services/priceHistory";
import { TARKOV_API_HEADERS } from "../services/tarkovApi";

const PRICE_HISTORY_REQUEST_TIMEOUT_MS = 30_000;

export const PRICE_HISTORY_REVALIDATE_SECONDS = 2 * 60 * 60;

interface UpstreamPriceResponse {
    data?: unknown;
}

export async function fetchCachedJsonPriceHistory(
    mode: TarkovJsonGameMode,
    itemId: string,
): Promise<PriceHistoryPoint[]> {
    const response = await fetch(
        `https://json.tarkov.dev/${mode}/prices/${encodeURIComponent(itemId)}`,
        {
            headers: TARKOV_API_HEADERS,
            next: { revalidate: PRICE_HISTORY_REVALIDATE_SECONDS },
            signal: AbortSignal.timeout(PRICE_HISTORY_REQUEST_TIMEOUT_MS),
        },
    );
    if (!response.ok) {
        throw new Error(`Price history request failed with status ${response.status}`);
    }
    const body = (await response.json()) as UpstreamPriceResponse;
    return normalizePriceHistory(body.data);
}
