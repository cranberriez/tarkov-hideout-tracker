"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useGameDataEnabled } from "../query/game-data";
import { toTarkovJsonGameMode, type TarkovJsonGameMode } from "../game-mode";
import { useUserStore } from "../stores/useUserStore";
import { gameDataKey } from "../query/scope";
import { RequestError } from "../query/request";
import { searchIdentityOptions, searchManifestOptions } from "./query";

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

export function SearchManifestBackground() {
	const mode = toTarkovJsonGameMode(useUserStore((state) => state.gameMode));
	const [idle, setIdle] = useState(false);
	const client = useQueryClient();
	const result = useSearchManifest(mode, idle);
	useEffect(() => {
		let handle: number;
		const schedule = () => {
			if (typeof window.requestIdleCallback === "function") handle = window.requestIdleCallback(() => setIdle(true));
			else handle = window.setTimeout(() => setIdle(true), 1000);
		};
		if (document.readyState === "complete") schedule();
		else window.addEventListener("load", schedule, { once: true });
		return () => {
			window.removeEventListener("load", schedule);
			if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(handle);
			window.clearTimeout(handle);
		};
	}, []);
	useEffect(() => {
		if (!result.data) return;
		const releaseId = result.data.releaseId;
		const predicate = (query: { queryKey: readonly unknown[] }) =>
			query.queryKey[3] === 1 && query.queryKey[4] !== releaseId;
		const filters = { queryKey: gameDataKey(mode, "search-manifest"), predicate };
		void client.cancelQueries(filters);
		client.removeQueries(filters);
	}, [client, mode, result.data]);
	return null;
}
