import { useMemo } from "react";
import type { Position } from "@/features/sync/companion-contract";
import { useSyncHydrated } from "@/features/sync/useSyncHydrated";
import { useCompanionSyncStore } from "@/lib/stores/useCompanionSyncStore";
import type { PlayerPosition, PlayerTrack } from "../tarkov-map";

export const SELF_TRACK = "self";

const toPlayerPosition = (position: Position): PlayerPosition => ({
	x: position.x,
	y: position.y,
	z: position.z,
	heading: position.yaw,
	at: position.captured_at,
	key: `${position.captured_at}|${position.x}|${position.z}`,
});

/** The player's track from the sync trail, keeping only positions taken on `mapKey` (they are in that map's coordinates). */
export function playerTrackFor(trail: readonly Position[], mapKey: string, live: boolean): PlayerTrack | null {
	const positions = trail.filter((position) => position.map?.normalized_name === mapKey).map(toPlayerPosition);
	return positions.length ? { id: SELF_TRACK, live, positions } : null;
}

/** Companion sync's player on this map. `active` is false unless Mappinator is connected, which gates the follow button. */
export function useSyncedPlayer(mapKey: string): { active: boolean; players: PlayerTrack[] | undefined } {
	const hydrated = useSyncHydrated();
	const connected = useCompanionSyncStore((state) => !!state.connection && state.status === "connected");
	const trail = useCompanionSyncStore((state) => state.position.trail);
	const inRaid = useCompanionSyncStore((state) => state.raid?.phase === "loading" || state.raid?.phase === "in_raid");
	const active = hydrated && connected;
	const players = useMemo(() => {
		const track = active ? playerTrackFor(trail, mapKey, inRaid) : null;
		return track ? [track] : undefined;
	}, [active, trail, mapKey, inRaid]);
	return { active, players };
}
