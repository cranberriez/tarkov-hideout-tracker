import { queryOptions } from "@tanstack/react-query";
import type { TarkovJsonGameMode } from "../game-mode";
import { gameDataKey } from "../query/scope";
import { fetchJson, ResponseValidationError } from "../query/request";
import { decodeSearchManifest } from "./manifest";

export function searchIdentityOptions(mode: TarkovJsonGameMode) {
	return queryOptions({
		queryKey: gameDataKey(mode, "search-identity", 1),
		queryFn: async ({ signal }) => {
			const value = await fetchJson<{ v: number; mode: string; releaseId: string }>(
				`/api/search?mode=${mode}&identity=1`,
				{ signal },
			);
			if (
				!value ||
				value.v !== 1 ||
				value.mode !== mode ||
				typeof value.releaseId !== "string" ||
				!value.releaseId.trim()
			)
				throw new ResponseValidationError("Invalid search release identity");
			return value;
		},
		staleTime: 5 * 60_000,
		refetchInterval: 5 * 60_000,
		gcTime: Infinity,
	});
}

export function searchManifestOptions(mode: TarkovJsonGameMode, releaseId: string) {
	return queryOptions({
		queryKey: gameDataKey(mode, "search-manifest", 2, releaseId),
		queryFn: async ({ signal }) =>
			decodeSearchManifest(
				// `format` only separates CDN entries when the immutable body gains fields.
				await fetchJson<unknown>(`/api/search?${new URLSearchParams({ mode, releaseId, format: "2" })}`, { signal }),
				mode,
				releaseId,
			),
		staleTime: Infinity,
		gcTime: Infinity,
	});
}
