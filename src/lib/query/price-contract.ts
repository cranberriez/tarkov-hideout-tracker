import type { TarkovDataMode } from "../../types/common";
import type { CurrentPrice } from "../../types/prices";

export const PRICE_BATCH_LIMIT = 200;
export const PRICE_STALE_TIME = 60 * 60_000;
export const PRICE_GC_TIME = 24 * PRICE_STALE_TIME;
export type PriceScope = "checklist" | "recipes";
export type PriceRequest = { mode: TarkovDataMode } & ({ ids: string[]; scope?: never } | { scope: PriceScope; ids?: never });
export interface PriceResponse {
    itemIds: string[];
    prices: Record<string, CurrentPrice>;
}

export function canonicalPriceIds(ids: readonly string[]) {
    return [...new Set(ids)].sort();
}

// Recipes can contain synthetic references (for example generic dog tags).
// They remain in the recipe graph but never have a market-price endpoint.
export function isPriceItemId(id: string) {
    return /^[a-f0-9]{24}$/.test(id);
}

export function parsePriceRequest(params: URLSearchParams): PriceRequest | null {
    const mode = params.get("mode");
    if (mode !== "regular" && mode !== "pve" && mode !== "pvp-season") return null;
    if (params.getAll("mode").length !== 1 || params.getAll("scope").length > 1 || params.getAll("ids").length > 1) return null;
    if (params.has("scope")) {
        const scope = params.get("scope");
        return (scope === "checklist" || scope === "recipes") && !params.has("ids") ? { mode, scope } : null;
    }
    const ids = params.get("ids")?.split(",") ?? [];
    if (!ids.length || ids.length > PRICE_BATCH_LIMIT || ids.some((id) => !isPriceItemId(id))) return null;
    return { mode, ids: canonicalPriceIds(ids) };
}
