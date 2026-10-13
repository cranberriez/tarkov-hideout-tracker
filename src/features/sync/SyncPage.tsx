"use client";

import { useEffect, useState } from "react";
import { useCompanionSyncStore, type ActivityEntry, type PairingProgress } from "@/lib/stores/useCompanionSyncStore";
import { useUserStore } from "@/lib/stores/useUserStore";
import {
	applyReview,
	canUndo,
	connectCompanion,
	disconnectCompanion,
	dismissReview,
	undoEntry,
} from "./companion-actions";
import { activeProfileKey, describeCounts, describeProfile } from "./sync-model";
import { useSyncHydrated } from "./useSyncHydrated";

const SECTION_TITLE = "text-[10px] font-semibold uppercase tracking-[0.25em] text-subtle-foreground";
const LINK_BUTTON = "text-xs font-medium text-brand hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline";
const PRIMARY_BUTTON =
	"rounded border border-brand/60 bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand transition-colors hover:bg-brand hover:text-inverse";

function useNow(intervalMs: number): number {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), intervalMs);
		return () => clearInterval(timer);
	}, [intervalMs]);
	return now;
}

function relativeTime(iso: string, now: number): string {
	const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
	if (Number.isNaN(seconds)) return "";
	if (seconds < 60) return "just now";
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
	if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
	return `${Math.floor(seconds / 86_400)}d ago`;
}

function pairingMessage(pairing: PairingProgress | null, now: number): string | null {
	switch (pairing?.phase) {
		case "scanning":
			return "Looking for Mappinator…";
		case "waiting":
			return `Approve in Mappinator · ${Math.max(0, Math.ceil((pairing.expiresAt - now) / 1000))}s`;
		case "denied":
			return "Pairing was denied in Mappinator.";
		case "expired":
			return "Pairing expired. Try again.";
		case "unreachable":
			return "Mappinator not found. Is it running with Site connection on? Chrome/Edge may ask to allow local network access.";
		case "failed":
			return "Mappinator refused the pairing request.";
		default:
			return null;
	}
}

export function SyncPage() {
	return (
		<div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 sm:px-6">
			<header className="border-b border-[var(--brand)]/20 pb-5">
				<p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--brand)]">Desktop companion</p>
				<h1 className="text-2xl font-semibold text-foreground">Sync</h1>
				<p className="mt-2 text-xs text-muted-foreground">
					Complete quests automatically from your game logs with the Mappinator desktop app.
				</p>
			</header>
			<ConnectionSection />
			<ActivitySection />
			<section aria-labelledby="sync-download" className="space-y-2 pt-2">
				<h2 id="sync-download" className={SECTION_TITLE}>
					Download
				</h2>
				<p className="text-sm text-muted-foreground">Desktop app download coming soon.</p>
			</section>
		</div>
	);
}

function ConnectionSection() {
	const hydrated = useSyncHydrated();
	const connection = useCompanionSyncStore((state) => state.connection);
	const status = useCompanionSyncStore((state) => state.status);
	const pairing = useCompanionSyncStore((state) => state.pairing);
	const lastSyncAt = useCompanionSyncStore((state) => state.lastSyncAt);
	const now = useNow(1000);

	const busy = pairing?.phase === "scanning" || pairing?.phase === "waiting";
	const pairingText = pairingMessage(pairing, now);
	let statusText = "Not connected";
	if (!hydrated) statusText = "Loading…";
	else if (connection) {
		if (status === "revoked") statusText = "Access was revoked in Mappinator. Connect again to resume.";
		else if (status === "unreachable") statusText = "Connected, but Mappinator is not responding (app not running or blocked by the browser).";
		else if (status === "connected")
			statusText = `Connected${lastSyncAt ? ` · synced ${relativeTime(new Date(lastSyncAt).toISOString(), now)}` : ""}`;
		else statusText = "Connected · checking…";
	}

	return (
		<section aria-labelledby="sync-connection" className="space-y-2 pt-2">
			<h2 id="sync-connection" className={SECTION_TITLE}>
				Connection
			</h2>
			<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
				<p className="text-sm text-foreground">{pairingText && busy ? pairingText : statusText}</p>
				{hydrated &&
					(busy ? (
						<span className="text-xs text-subtle-foreground">Waiting…</span>
					) : (
						<>
							{(!connection || status === "revoked") && (
								<button type="button" onClick={() => void connectCompanion()} className={PRIMARY_BUTTON}>
									Connect
								</button>
							)}
							{connection && (
								<button type="button" onClick={() => void disconnectCompanion()} className={LINK_BUTTON}>
									Disconnect
								</button>
							)}
						</>
					))}
			</div>
			{pairingText && !busy && <p className="text-xs text-warning">{pairingText}</p>}
		</section>
	);
}

const STATUS_LABEL: Record<ActivityEntry["status"], string> = {
	applied: "applied",
	waiting: "waiting",
	undone: "undone",
	dismissed: "dismissed",
};

function ActivitySection() {
	const log = useCompanionSyncStore((state) => state.log);
	const review = useCompanionSyncStore((state) => state.review);
	const unknownMode = useCompanionSyncStore((state) => state.unknownMode);
	const gameMode = useUserStore((state) => state.gameMode);
	const selectedSeasonId = useUserStore((state) => state.selectedSeasonId);
	const now = useNow(30_000);
	const active = activeProfileKey(gameMode, selectedSeasonId);
	const reviewRows = Object.entries(review).filter(([, items]) => items.length > 0);

	return (
		<section aria-labelledby="sync-activity" className="space-y-2 pt-2">
			<h2 id="sync-activity" className={SECTION_TITLE}>
				Activity
			</h2>
			{log.length === 0 && reviewRows.length === 0 && unknownMode === 0 && (
				<p className="text-sm text-muted-foreground">Nothing synced yet.</p>
			)}
			{log.length > 0 && (
				<ul className="divide-y divide-highlight/10 text-sm">
					{log.map((entry) => (
						<li key={entry.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
							<span className="w-12 text-xs font-semibold text-foreground">{describeProfile(entry.profile)}</span>
							<span className="text-foreground">{describeCounts(entry.completed, entry.failed)}</span>
							<span className="text-xs text-subtle-foreground">{relativeTime(entry.at, now)}</span>
							<span className="text-xs text-subtle-foreground">{STATUS_LABEL[entry.status]}</span>
							{canUndo(entry) &&
								(entry.profile === active ? (
									<button type="button" onClick={() => undoEntry(entry.id)} className={LINK_BUTTON}>
										Undo
									</button>
								) : (
									<span className="text-xs text-subtle-foreground">switch to {describeProfile(entry.profile)} to undo</span>
								))}
						</li>
					))}
				</ul>
			)}
			{reviewRows.map(([profile, items]) => {
				const completions = items.filter((item) => item.action === "completed").length;
				const failures = items.length - completions;
				const label = describeProfile(profile);
				return (
					<div key={profile} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
						<span className="text-foreground">
							Found in logs: {describeCounts(completions, failures)} {label}
						</span>
						{profile === active ? (
							<button type="button" onClick={() => applyReview(profile)} className={LINK_BUTTON}>
								Apply
							</button>
						) : (
							<span className="text-xs text-subtle-foreground">switch to {label} to apply</span>
						)}
						<button type="button" onClick={() => dismissReview(profile)} className={LINK_BUTTON}>
							Dismiss
						</button>
					</div>
				);
			})}
			{unknownMode > 0 && (
				<p className="text-xs text-subtle-foreground">
					{unknownMode} {unknownMode === 1 ? "event" : "events"} with unknown game mode
				</p>
			)}
		</section>
	);
}
