import { queryOptions } from "@tanstack/react-query";
import type { TarkovJsonGameMode } from "../game-mode";
import { gameDataKey } from "../query/scope";
import { fetchJson } from "../query/request";
import { decodeSearchManifest, SEARCH_MANIFEST_FORMAT } from "./manifest";

export function searchManifestOptions(mode: TarkovJsonGameMode) {
	return queryOptions({
		queryKey: gameDataKey(mode, "search-manifest", SEARCH_MANIFEST_FORMAT),
		queryFn: async ({ signal }) =>
			decodeSearchManifest(
				await fetchJson<unknown>(`/api/search?${new URLSearchParams({ mode, format: SEARCH_MANIFEST_FORMAT })}`, {
					signal,
				}),
				mode,
			),
		staleTime: 5 * 60_000,
		gcTime: Infinity,
	});
}
