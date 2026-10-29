import { useCallback, useState } from "react";
import type { WorldPoint } from "./types";

/** One known position of a player, in world coordinates. */
export type PlayerPosition = WorldPoint & {
  /** Unique within its track: a later position with the same key replaces it. */
  key: string;
  /** Degrees clockwise from world +Z, when known. */
  heading?: number | null;
  /** When it was taken (ISO 8601); shown on hover and fades the newest marker as it ages. */
  at?: string;
};

/** A player's positions, oldest first; the last is where they were last seen. */
export type PlayerTrack = {
  id: string;
  label?: string;
  /** CSS colour of the newest marker; the theme accent when omitted. */
  color?: string;
  /** Still being updated: the newest marker glows, fading over two minutes from its `at`. */
  live?: boolean;
  /** Extra class on the track's element, for styling a kind of player (e.g. other group members). */
  className?: string;
  /** A character or two drawn upright inside the newest marker, e.g. the player's initial. */
  badge?: string;
  positions: PlayerPosition[];
};

export type TrackInfo = Partial<Pick<PlayerTrack, "label" | "color" | "live" | "className">>;

/** 1 when just taken, easing to 0 over `window` milliseconds. */
export function freshness(at: string, now: number, window = 120_000): number {
  const time = Date.parse(at);
  if (Number.isNaN(time)) return 0;
  return Math.min(1, Math.max(0, 1 - (now - time) / window));
}

/**
 * `tracks` with a position added to one (created when missing), replacing any with the same key and keeping
 * only the newest `limit`.
 */
export function withPosition(tracks: PlayerTrack[], trackId: string, position: PlayerPosition, info: TrackInfo = {}, limit = Infinity): PlayerTrack[] {
  const track = tracks.find((other) => other.id === trackId) ?? { id: trackId, positions: [] };
  const positions = [...track.positions.filter((other) => other.key !== position.key), position].slice(-limit);
  const next = { ...track, ...info, positions };
  return tracks.some((other) => other.id === trackId) ? tracks.map((other) => other.id === trackId ? next : other) : [...tracks, next];
}

/**
 * Player tracks in React state, for feeds that deliver positions one at a time (a sync connection, other players).
 * Pass `tracks` to `<TarkovMap players>`; `add` appends a position (see `withPosition`), `remove` drops a track.
 */
export function usePlayerTracks({ initial = [], limit = Infinity }: { initial?: PlayerTrack[]; limit?: number } = {}) {
  const [tracks, setTracks] = useState<PlayerTrack[]>(initial);
  const add = useCallback((trackId: string, position: PlayerPosition, info?: TrackInfo) =>
    setTracks((current) => withPosition(current, trackId, position, info, limit)), [limit]);
  const remove = useCallback((trackId: string) => setTracks((current) => current.filter((track) => track.id !== trackId)), []);
  const clear = useCallback(() => setTracks([]), []);
  return { tracks, add, remove, clear, set: setTracks };
}
