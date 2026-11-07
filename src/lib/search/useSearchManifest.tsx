"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useGameDataEnabled } from "../query/game-data";
import { toTarkovJsonGameMode, type TarkovJsonGameMode } from "../game-mode";
import { useUserStore } from "../stores/useUserStore";
import { RequestError } from "../query/request";
import { removeOldSearchManifests, searchIdentityOptions, searchManifestOptions } from "./query";

export function useSearchManifest(mode: TarkovJsonGameMode, enabled: boolean) {
	const scoped = useGameDataEnabled(mode) && enabled;
	const identity = useQuery({ ...searchIdentityOptions(mode), enabled: scoped });
	const releaseId = identity.data?.releaseId ?? "";
	const manifest = useQuery({ ...searchManifestOptions(mode, releaseId), enabled: scoped && !!releaseId });
	const client = useQueryClient();
	useEffect(() => {
		if (manifest.error instanceof RequestError && manifest.error.status === 409) {
			void client.invalidateQueries({ queryKey: searchIdentityOptions(mode).queryKey });
		}
	}, [client, manifest.error, mode]);
	useEffect(() => {
		if (scoped && manifest.data) removeOldSearchManifests(client, mode, manifest.data.releaseId);
	}, [client, mode, scoped, manifest.data]);
	return {
		data: scoped ? manifest.data : undefined,
		error: scoped ? (manifest.error ?? identity.error) : null,
		retry: async () => {
			const refreshed = await identity.refetch();
			if (refreshed.data && toTarkovJsonGameMode(useUserStore.getState().gameMode) === mode) {
				await client.fetchQuery(searchManifestOptions(mode, refreshed.data.releaseId));
			}
		},
	};
}
