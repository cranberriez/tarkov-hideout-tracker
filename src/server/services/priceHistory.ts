import type { PriceHistoryPoint } from "@/types/prices";
import type { TarkovJsonGameMode } from "@/server/services/tarkovJson/client";
import { TARKOV_API_HEADERS } from "./tarkovApi";

const PRICE_HISTORY_REQUEST_TIMEOUT_MS = 30_000;

export const PRICE_HISTORY_CUTOFF_TIMESTAMP = Date.UTC(2025, 11, 1);

interface UpstreamPricePoint {
    price?: unknown;
    priceMin?: unknown;
    offerCount?: unknown;
    timestamp?: unknown;
}

function numeric(value: unknown): number {
    return typeof value === "number" || (typeof value === "string" && value.trim() !== "")
        ? Number(value) : NaN;
}

export function normalizePriceHistory(data: unknown, strict = false): PriceHistoryPoint[] {
    if (!Array.isArray(data)) {
        if (strict) throw new Error("Invalid price history response");
        return [];
    }
    const points = new Map<number, PriceHistoryPoint>();
    for (const raw of data) {
        const point: UpstreamPricePoint = typeof raw === "object" && raw !== null ? raw : {};
        const normalized = {
            price: numeric(point.price), priceMin: numeric(point.priceMin),
            timestamp: numeric(point.timestamp),
            offerCount: point.offerCount == null ? null : numeric(point.offerCount),
        };
        const valid = Number.isFinite(normalized.price) && normalized.price >= 0 &&
            Number.isFinite(normalized.priceMin) && normalized.priceMin >= 0 &&
            Number.isFinite(normalized.timestamp) && normalized.timestamp > 0 &&
            (normalized.offerCount === null || (Number.isInteger(normalized.offerCount) && normalized.offerCount >= 0)) &&
            (normalized.offerCount === 0 || (normalized.price > 0 && normalized.priceMin > 0));
        if (!valid) {
            if (strict) throw new Error("Invalid price history point");
            continue;
        }
        if (normalized.timestamp >= PRICE_HISTORY_CUTOFF_TIMESTAMP) points.set(normalized.timestamp, normalized);
    }
    return [...points.values()].sort((a, b) => a.timestamp - b.timestamp);
}

interface UpstreamPriceResponse {
    data?: unknown;
}

export type PriceHistoryFetchResult =
    | { status: "not-modified"; etag: string | null }
    | { status: "updated"; etag: string | null; data: PriceHistoryPoint[] };

export async function fetchJsonPriceHistory(
    mode: TarkovJsonGameMode,
    itemId: string,
    etag?: string | null,
): Promise<PriceHistoryFetchResult> {
    const headers = new Headers(TARKOV_API_HEADERS);
    if (etag) headers.set("If-None-Match", etag);
    const response = await fetch(
        `https://json.tarkov.dev/${mode}/prices/${encodeURIComponent(itemId)}`,
        {
            headers,
            cache: "no-store",
            signal: AbortSignal.timeout(PRICE_HISTORY_REQUEST_TIMEOUT_MS),
        },
    );
    const responseEtag = response.headers.get("etag") ?? etag ?? null;
    if (response.status === 304) {
        return { status: "not-modified", etag: responseEtag };
    }
    if (!response.ok) {
        throw new Error(`Price history request failed with status ${response.status}`);
    }
    const body = (await response.json()) as UpstreamPriceResponse;
    return {
        status: "updated",
        etag: responseEtag,
        data: normalizePriceHistory(body.data, true),
    };
}
