import type { QueryClient } from "@tanstack/react-query";

export type GameDataMode = "regular" | "pve" | "pvp-season";

export function gameDataKey(mode: GameDataMode, domain: string, ...parts: readonly unknown[]) {
	return ["game-data", mode, domain, ...parts] as const;
}

export async function removeGameDataScope(client: QueryClient, mode: GameDataMode) {
	const queryKey = ["game-data", mode];
	const cancellation = client.cancelQueries({ queryKey });
	client.removeQueries({ queryKey });
	await cancellation;
}
