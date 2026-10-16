/** Mirrors the Mappinator companion's `src/bindings` (HTTP protocol 1). Hand-written; keep in step with the app. */

export const COMPANION_PORTS = [47615, 47616, 47617, 47618, 47619] as const;
export const COMPANION_APP_ID = "tarkov-mappinator";

export type QuestAction = "accepted" | "completed" | "failed";
export type RaidPhase = "loading" | "in_raid" | "ended";
/** Session mode as the companion reports it; anything else is unknown. */
export type CompanionMode = "regular" | "pve" | "pvp-season";

export interface MapRef {
	raw: string;
	normalized_name: string | null;
}

export interface Position {
	map: MapRef | null;
	x: number;
	y: number;
	z: number;
	yaw: number | null;
	captured_at: string;
}

export interface CurrentRaid {
	phase: RaidPhase;
	map: MapRef | null;
	mode: string | null;
	recovered: boolean;
}

/** A group member on the player's raid map (latest position only). */
export interface GroupMember {
	id: string;
	name: string;
	position: Position;
}

export interface CurrentState {
	scanner_running: boolean;
	raid: CurrentRaid | null;
	position: Position | null;
	/** Other group members on the player's raid map. Absent from older Mappinator versions. */
	group?: GroupMember[];
}

interface CompanionEventBase {
	/** Monotonic within an `epoch`. */
	seq: number;
	/** Stable across replays, for idempotent apply. */
	id: string;
	at: string;
	/** Read from history when monitoring started rather than observed live. */
	recovered: boolean;
	/** Session mode when observed (`regular` | `pve` | `pvp-season`); string so unknown values survive. */
	mode: string | null;
}

export type CompanionEvent = CompanionEventBase &
	(
		| { kind: "quest"; action: QuestAction; quest_id: string }
		| { kind: "raid"; phase: RaidPhase; map: MapRef | null }
		| ({ kind: "position" } & Position)
	);

export type SourceState = "not_configured" | "available" | "unavailable";

export interface StatusResponse {
	app: string;
	version: string;
	protocol: number;
	paired: boolean;
	epoch?: string;
	seq?: number;
	scanner_running?: boolean;
	logs?: SourceState;
	screenshots?: SourceState;
}

export interface PairRequested {
	pairing_id: string;
	expires_in_secs: number;
}

export type PairingState =
	| { state: "pending" }
	| { state: "allowed"; token: string }
	| { state: "denied" }
	| { state: "expired" };

/** `GET /v1/sync?since=<seq>`. */
export interface SyncResponse {
	protocol: number;
	/** Changes when the app restarts: discard the cursor and sync from 0. */
	epoch: string;
	seq: number;
	/** Oldest retained seq; events before it were dropped. */
	oldest: number;
	state: CurrentState;
	events: CompanionEvent[];
}
