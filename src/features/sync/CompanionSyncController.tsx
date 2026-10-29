"use client";

import { useEffect } from "react";
import { useCompanionSyncStore } from "@/lib/stores/useCompanionSyncStore";
import { useUserStore } from "@/lib/stores/useUserStore";
import { applyPendingForActive, runSyncOnce } from "./companion-actions";
import { SyncNotice } from "./SyncNotice";
import { useSyncHydrated } from "./useSyncHydrated";

const IDLE_MS = 30_000;
const RAID_MS = 3_000;

/** Polls the paired companion, applies quest events to the active profile, and shows the corner notice. */
export function CompanionSyncController() {
	const hydrated = useSyncHydrated();
	const token = useCompanionSyncStore((state) => state.connection?.token);

	// Queued changes apply when their profile becomes active (never switches profiles itself).
	useEffect(() => {
		if (!hydrated) return;
		applyPendingForActive();
		return useUserStore.subscribe((state, previous) => {
			if (state.gameMode !== previous.gameMode || state.selectedSeasonId !== previous.selectedSeasonId) {
				applyPendingForActive();
			}
		});
	}, [hydrated]);

	useEffect(() => {
		if (!hydrated || !token) return;
		let stopped = false;
		let running = false;
		let timer: ReturnType<typeof setTimeout> | undefined;

		const schedule = (ms: number) => {
			clearTimeout(timer);
			if (!stopped) timer = setTimeout(tick, ms);
		};
		async function tick() {
			if (stopped || running) return;
			running = true;
			try {
				const { stop, fast } = await runSyncOnce();
				if (!stop) schedule(fast ? RAID_MS : IDLE_MS);
			} catch (error) {
				// A bug in applying a response must not end polling: report it and try again.
				console.error("Mappinator sync failed", error);
				useCompanionSyncStore.getState().setSyncError(error instanceof Error ? error.message : String(error));
				schedule(IDLE_MS);
			} finally {
				running = false;
			}
		}
		const refresh = () => {
			if (document.visibilityState === "visible" && !running) void tick();
		};

		void tick();
		window.addEventListener("focus", refresh);
		document.addEventListener("visibilitychange", refresh);
		return () => {
			stopped = true;
			clearTimeout(timer);
			window.removeEventListener("focus", refresh);
			document.removeEventListener("visibilitychange", refresh);
		};
	}, [hydrated, token]);

	return <SyncNotice />;
}
