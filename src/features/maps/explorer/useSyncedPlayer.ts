import { useMemo } from "react";
import type { GroupMember, Position } from "@/features/sync/companion-contract";
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

/** Group members as tracks (newest position only), those on `mapKey`, in the colours given. */
export function memberTracksFor(members: readonly GroupMember[], mapKey: string, colors: Readonly<Record<string, string>>): PlayerTrack[] {
	return members
		.filter((member) => member.position.map?.normalized_name === mapKey)
		.map((member) => ({
			id: `peer:${member.id}`,
			label: member.name,
			color: colors[member.id],
			className: "peer",
			badge: member.name.slice(0, 1).toUpperCase(),
			positions: [toPlayerPosition(member.position)],
		}));
}

/**
 * Companion sync's player and group members on this map. `active` is false unless Mappinator is connected, which gates
 * the follow button. The player comes first, so with nothing followed the map opens on them.
 */
export function useSyncedPlayer(mapKey: string): { active: boolean; players: PlayerTrack[] | undefined } {
	const hydrated = useSyncHydrated();
	const connected = useCompanionSyncStore((state) => !!state.connection && state.status === "connected");
	const trail = useCompanionSyncStore((state) => state.position.trail);
	const group = useCompanionSyncStore((state) => state.group);
	const inRaid = useCompanionSyncStore((state) => state.raid?.phase === "loading" || state.raid?.phase === "in_raid");
	const active = hydrated && connected;
	const colors = useCompanionSyncStore((state) => state.memberColors);
	const players = useMemo(() => {
		if (!active) return undefined;
		const self = playerTrackFor(trail, mapKey, inRaid);
		const tracks = [...(self ? [self] : []), ...memberTracksFor(group, mapKey, colors)];
		return tracks.length ? tracks : undefined;
	}, [active, trail, group, colors, mapKey, inRaid]);
	return { active, players };
}
