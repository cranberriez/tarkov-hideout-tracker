"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useCompanionSyncStore } from "@/lib/stores/useCompanionSyncStore";
import { useUserStore } from "@/lib/stores/useUserStore";
import { applyPendingForActive, runSyncOnce, undoEntry } from "./companion-actions";
import { activeProfileKey, describeCounts, describeProfile } from "./sync-model";
import { useSyncHydrated } from "./useSyncHydrated";

const IDLE_MS = 30_000;
const RAID_MS = 3_000;
const NOTICE_MS = 8_000;

/** Polls the paired companion, applies quest events to the active profile, and shows a small notice. */
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

function SyncNotice() {
	const notice = useCompanionSyncStore((state) => state.notice);
	const entry = useCompanionSyncStore((state) => state.log.find((e) => e.id === state.notice?.logId));
	const gameMode = useUserStore((state) => state.gameMode);
	const selectedSeasonId = useUserStore((state) => state.selectedSeasonId);
	const clearNotice = useCompanionSyncStore((state) => state.clearNotice);
	const [hovered, setHovered] = useState(false);
	const nonce = notice?.nonce;

	useEffect(() => {
		if (nonce === undefined || hovered) return;
		const timer = setTimeout(clearNotice, NOTICE_MS);
		return () => clearTimeout(timer);
	}, [nonce, hovered, clearNotice]);

	if (!notice || !entry) return null;
	const canUndo = entry.status === "applied" && !!entry.undo?.quests.length;
	const isActive = entry.profile === activeProfileKey(gameMode, selectedSeasonId);
	const label = describeProfile(entry.profile);

	return (
		<div
			role="status"
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
			className="fixed bottom-4 right-4 z-50 flex max-w-sm items-center gap-3 rounded-md border border-highlight/10 bg-card px-3 py-2 text-xs text-foreground shadow-md"
		>
			<span>
				<span className="text-subtle-foreground">Mappinator · </span>
				{entry.status === "undone" ? "undone" : `${describeCounts(entry.completed, entry.failed)} ${label} ${entry.completed + entry.failed === 1 ? "quest" : "quests"}`}
			</span>
			{canUndo &&
				(isActive ? (
					<button type="button" onClick={() => undoEntry(entry.id)} className="font-medium text-brand hover:underline">
						Undo
					</button>
				) : (
					<span className="text-subtle-foreground">switch to {label} to undo</span>
				))}
			<button type="button" aria-label="Dismiss" onClick={clearNotice} className="text-subtle-foreground hover:text-foreground">
				<X size={14} />
			</button>
		</div>
	);
}
