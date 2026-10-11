"use client";
import { useUserStore } from "../stores/useUserStore";
import type { GameMode } from "../game-mode";
import { profileStorageScope } from "./profile-scope";
export function useProfileStorageScope(mode: GameMode) {
	const seasonId = useUserStore((state) => state.selectedSeasonId);
	return profileStorageScope(mode, seasonId);
}
