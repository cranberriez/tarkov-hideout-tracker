"use client";

import { useQuery } from "@tanstack/react-query";
import { useGameDataEnabled } from "../query/game-data";
import type { TarkovJsonGameMode } from "../game-mode";
import { searchManifestOptions } from "./query";

export function useSearchManifest(mode: TarkovJsonGameMode, enabled: boolean) {
	const scoped = useGameDataEnabled(mode) && enabled;
	const manifest = useQuery({ ...searchManifestOptions(mode), enabled: scoped });
	return {
		data: scoped ? manifest.data : undefined,
		error: scoped ? manifest.error : null,
		retry: manifest.refetch,
	};
}
