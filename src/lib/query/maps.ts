import { queryOptions } from "@tanstack/react-query";
import type { MapOverlayMarker, MapRenderDefinition } from "@/types/maps";
import { fetchJson, ResponseValidationError } from "./request";

export function mapMetadataQueryOptions(mapKey: string) {
	return queryOptions({
		queryKey: ["map-metadata", mapKey] as const,
		queryFn: ({ signal }) => fetchJson<MapRenderDefinition>(`/api/maps/render/${encodeURIComponent(mapKey)}`, { signal }),
		staleTime: 60 * 60 * 1000,
		gcTime: 24 * 60 * 60 * 1000,
		retry: false,
	});
}

export function mapOverlaysQueryOptions(mapKey: string) {
	return queryOptions({
		queryKey: ["map-overlays", mapKey] as const,
		queryFn: async ({ signal }) => {
			const payload = await fetchJson<{ markers?: unknown }>(
				`/api/maps/overlays/${encodeURIComponent(mapKey)}`,
				{ signal },
			);
			if (!Array.isArray(payload.markers)) throw new ResponseValidationError("Map overlays are invalid");
			return { markers: payload.markers as MapOverlayMarker[] };
		},
		staleTime: 60 * 60 * 1000,
		gcTime: 24 * 60 * 60 * 1000,
		retry: false,
	});
}
