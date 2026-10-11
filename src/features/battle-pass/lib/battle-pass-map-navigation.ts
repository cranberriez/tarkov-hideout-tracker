export const DOCUMENT_MAP_HISTORY_KEY = "tarkovDocumentMapV1";

export type DocumentMapRoute = { id: string; slug: string; floorIds: string[] };
export type DocumentMapSnapshot = {
	mapId: string;
	view: { scale: number; x: number; y: number };
	hiddenFloors: string[];
	hiddenTypes: string[];
	mapColors: boolean;
};

function record(value: unknown): Record<string, unknown> | undefined {
	return value !== null && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;
}

function selectedKeys(value: unknown, allowed: readonly string[]) {
	return Array.isArray(value)
		? [...new Set(value.filter((key): key is string => typeof key === "string" && allowed.includes(key)))]
		: [];
}

function finiteNumber(value: unknown, fallback: number, min: number, max: number) {
	return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

export function defaultDocumentMapSnapshot(mapId: string): DocumentMapSnapshot {
	return { mapId, view: { scale: 1, x: 0, y: 0 }, hiddenFloors: [], hiddenTypes: [], mapColors: false };
}

/** The shareable URL selects the map; entry state supplies only that map's display snapshot. */
export function readDocumentMapSnapshot(
	url: URL,
	historyState: unknown,
	maps: readonly DocumentMapRoute[],
	documentKeys: readonly string[],
): DocumentMapSnapshot {
	const map = maps.find((entry) => entry.slug === url.searchParams.get("map")) ?? maps[0];
	const fallback = defaultDocumentMapSnapshot(map?.id ?? "");
	const saved = record(record(historyState)?.[DOCUMENT_MAP_HISTORY_KEY]);
	if (!map || saved?.mapId !== map.id) return fallback;
	const view = record(saved.view);
	return {
		mapId: map.id,
		view: {
			scale: finiteNumber(view?.scale, 1, 1, 8),
			x: finiteNumber(view?.x, 0, -100_000, 100_000),
			y: finiteNumber(view?.y, 0, -100_000, 100_000),
		},
		hiddenFloors: selectedKeys(saved.hiddenFloors, map.floorIds),
		hiddenTypes: selectedKeys(saved.hiddenTypes, documentKeys),
		mapColors: saved.mapColors === true,
	};
}

export function documentMapUrl(url: URL, map: Pick<DocumentMapRoute, "slug">) {
	const next = new URL(url);
	next.searchParams.set("map", map.slug);
	return `${next.pathname}${next.search}${next.hash}`;
}

/** Preserve Next's router tree and any other feature's history fields. */
export function documentMapHistoryState(historyState: unknown, snapshot: DocumentMapSnapshot) {
	return { ...record(historyState), [DOCUMENT_MAP_HISTORY_KEY]: snapshot };
}
