import { TARKOV_API_HEADERS } from "../tarkovApi";
import type { TarkovJsonGameMode } from "@/lib/game-mode";

export type { TarkovJsonGameMode } from "@/lib/game-mode";

const TARKOV_JSON_BASE_URL = "https://json.tarkov.dev";
const DEFAULT_TARKOV_JSON_REQUEST_TIMEOUT_MS = 120_000;
const TARKOV_JSON_REQUEST_MAX_ATTEMPTS = 3;
const TARKOV_JSON_RETRY_DELAY_MS = 250;

export type TarkovJsonEndpoint =
    | "barters"
    | "crafts"
    | "hideout"
    | "items"
    | "maps"
    | "tasks"
    | "traders";

interface TarkovJsonResponse<T> {
    data?: T;
    translations?: string[];
}

interface TarkovJsonLocaleResponse {
    data?: Record<string, string>;
}

export interface TarkovJsonDataset<T> {
    data: T;
    translate: (key: string | null | undefined) => string;
    locale: {
        requestedPath: string;
        resolvedPath: string;
        usedRegularFallback: boolean;
    };
}

const inFlightRequests = new Map<string, Promise<unknown>>();

function getRequestTimeoutMs(): number {
    const configured = Number(process.env.TARKOV_JSON_REQUEST_TIMEOUT_MS);
    return Number.isFinite(configured) && configured > 0
        ? configured
        : DEFAULT_TARKOV_JSON_REQUEST_TIMEOUT_MS;
}

function isRetryableStatus(status: number): boolean {
    return status === 408 || status === 429 || status >= 500;
}

function isRetryableError(error: unknown): boolean {
    return (
        (error instanceof DOMException && error.name === "TimeoutError") ||
        error instanceof TypeError
    );
}

async function waitBeforeRetry(attempt: number): Promise<void> {
    await new Promise((resolve) =>
        setTimeout(resolve, TARKOV_JSON_RETRY_DELAY_MS * 2 ** (attempt - 1)),
    );
}

async function fetchJson<T>(path: string): Promise<T> {
    const url = `${TARKOV_JSON_BASE_URL}/${path}`;
    const existing = inFlightRequests.get(url) as Promise<T> | undefined;
    if (existing) return existing;

    const request = (async () => {
        for (let attempt = 1; attempt <= TARKOV_JSON_REQUEST_MAX_ATTEMPTS; attempt += 1) {
            try {
                const response = await fetch(url, {
                    headers: TARKOV_API_HEADERS,
                    cache: "no-store",
                    signal: AbortSignal.timeout(getRequestTimeoutMs()),
                });
                if (!response.ok) {
                    const details = await response.text().catch(() => "");
                    const error = new Error(
                        `Tarkov JSON request failed for ${path}: ${response.status} ${response.statusText} - ${details.slice(0, 300)}`,
                    );
                    if (
                        !isRetryableStatus(response.status) ||
                        attempt === TARKOV_JSON_REQUEST_MAX_ATTEMPTS
                    ) {
                        throw error;
                    }
                    await waitBeforeRetry(attempt);
                    continue;
                }

                return (await response.json()) as T;
            } catch (error) {
                if (
                    !isRetryableError(error) ||
                    attempt === TARKOV_JSON_REQUEST_MAX_ATTEMPTS
                ) {
                    if (isRetryableError(error)) {
                        throw new Error(
                            `Tarkov JSON request failed for ${path} after ${attempt} attempts`,
                            { cause: error },
                        );
                    }
                    throw error;
                }
                await waitBeforeRetry(attempt);
            }
        }
        throw new Error(`Tarkov JSON request failed for ${path}`);
    })();

    inFlightRequests.set(url, request);
    try {
        return await request;
    } finally {
        inFlightRequests.delete(url);
    }
}

function hasEntries(data: object): boolean {
    return Array.isArray(data) ? data.length > 0 : Object.keys(data).length > 0;
}

async function fetchLocale(
    endpoint: TarkovJsonEndpoint,
    gameMode: TarkovJsonGameMode,
): Promise<{
    response: TarkovJsonLocaleResponse;
    requestedPath: string;
    resolvedPath: string;
}> {
    const localePath = `${gameMode}/${endpoint}_en`;

    try {
        return {
            response: await fetchJson<TarkovJsonLocaleResponse>(localePath),
            requestedPath: localePath,
            resolvedPath: localePath,
        };
    } catch (error) {
        if (gameMode === "regular") throw error;

        const fallbackPath = `regular/${endpoint}_en`;
        const reason = error instanceof Error ? error.message : String(error);
        console.warn(
            `Tarkov JSON locale ${localePath} was unavailable; falling back to ${fallbackPath} (${reason})`,
        );
        return {
            response: await fetchJson<TarkovJsonLocaleResponse>(fallbackPath),
            requestedPath: localePath,
            resolvedPath: fallbackPath,
        };
    }
}

export async function fetchTarkovJsonDataset<T extends object>(
    endpoint: TarkovJsonEndpoint,
    gameMode: TarkovJsonGameMode = "regular",
): Promise<TarkovJsonDataset<T>> {
    const path = `${gameMode}/${endpoint}`;
    const [response, localeResult] = await Promise.all([
        fetchJson<TarkovJsonResponse<T>>(path),
        fetchLocale(endpoint, gameMode),
    ]);

    if (!response.data || typeof response.data !== "object" || !hasEntries(response.data)) {
        throw new Error(`Tarkov JSON ${path} response is missing or empty data`);
    }

    const locale = localeResult.response.data;
    if (!locale || Object.keys(locale).length === 0) {
        throw new Error(`Tarkov JSON ${path}_en response is missing translations`);
    }

    return {
        data: response.data,
        translate: (key) => {
            if (!key) return "";
            return locale[key] || key;
        },
        locale: {
            requestedPath: localeResult.requestedPath,
            resolvedPath: localeResult.resolvedPath,
            usedRegularFallback: localeResult.requestedPath !== localeResult.resolvedPath,
        },
    };
}

export async function fetchTarkovJsonData<T extends object>(
    endpoint: TarkovJsonEndpoint,
    gameMode: TarkovJsonGameMode = "regular",
): Promise<T> {
    const path = `${gameMode}/${endpoint}`;
    const response = await fetchJson<TarkovJsonResponse<T>>(path);
    if (!response.data || typeof response.data !== "object" || !hasEntries(response.data)) {
        throw new Error(`Tarkov JSON ${path} response is missing or empty data`);
    }
    return response.data;
}
