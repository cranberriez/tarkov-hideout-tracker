import { TARKOV_API_HEADERS } from "../tarkovApi";

const TARKOV_JSON_BASE_URL = "https://json.tarkov.dev";

export type TarkovJsonGameMode = "regular" | "pve";
export type TarkovJsonEndpoint = "hideout" | "items" | "maps" | "tasks" | "traders";

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
}

const inFlightRequests = new Map<string, Promise<unknown>>();

async function fetchJson<T>(path: string): Promise<T> {
    const url = `${TARKOV_JSON_BASE_URL}/${path}`;
    const existing = inFlightRequests.get(url) as Promise<T> | undefined;
    if (existing) return existing;

    const request = (async () => {
        const response = await fetch(url, {
            headers: TARKOV_API_HEADERS,
            cache: "no-store",
        });
        if (!response.ok) {
            const details = await response.text().catch(() => "");
            throw new Error(
                `Tarkov JSON request failed for ${path}: ${response.status} ${response.statusText} - ${details.slice(0, 300)}`,
            );
        }

        return (await response.json()) as T;
    })();

    inFlightRequests.set(url, request);
    try {
        return await request;
    } finally {
        inFlightRequests.delete(url);
    }
}

export async function fetchTarkovJsonDataset<T extends object>(
    endpoint: TarkovJsonEndpoint,
    gameMode: TarkovJsonGameMode = "regular",
): Promise<TarkovJsonDataset<T>> {
    const path = `${gameMode}/${endpoint}`;
    const [response, localeResponse] = await Promise.all([
        fetchJson<TarkovJsonResponse<T>>(path),
        fetchJson<TarkovJsonLocaleResponse>(`${path}_en`),
    ]);

    if (!response.data || typeof response.data !== "object") {
        throw new Error(`Tarkov JSON ${path} response is missing data`);
    }

    const locale = localeResponse.data;
    if (!locale || Object.keys(locale).length === 0) {
        throw new Error(`Tarkov JSON ${path}_en response is missing translations`);
    }

    return {
        data: response.data,
        translate: (key) => {
            if (!key) return "";
            return locale[key] || key;
        },
    };
}
