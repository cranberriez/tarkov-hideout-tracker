"use client";

import { useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { useCompanionSyncStore, type PairingProgress } from "@/lib/stores/useCompanionSyncStore";
import { cn } from "@/lib/utils";
import { ActivityPanel } from "./ActivityPanel";
import { connectCompanion, disconnectCompanion, runSyncOnce } from "./companion-actions";
import { getStatus } from "./companion-client";
import type { SourceState } from "./companion-contract";
import { describeProfile, mapDisplayName, profileForMode } from "./sync-model";
import { relativeAge, useNow } from "./sync-view-utils";
import { useSyncHydrated } from "./useSyncHydrated";

const SECTION_TITLE = "text-[10px] font-semibold uppercase tracking-[0.25em] text-subtle-foreground";
const LINK_BUTTON =
	"text-xs font-medium text-brand hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline";
const PRIMARY_BUTTON =
	"rounded border border-brand/60 bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand transition-colors hover:bg-brand hover:text-inverse disabled:cursor-not-allowed disabled:opacity-50";

export function SyncPage() {
	return (
		<main className="container mx-auto flex-1 px-4 py-6 sm:px-6">
			<header className="mb-5 border-b border-[var(--brand)]/20 pb-4">
				<p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--brand)]">Desktop companion</p>
				<h1 className="text-2xl font-semibold text-foreground">Sync</h1>
			</header>
			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
				<aside className="space-y-6 lg:order-2">
					<ConnectionCard />
					<SummarySection />
				</aside>
				<ActivityPanel className="lg:order-1" />
			</div>
		</main>
	);
}

function pairingMessage(pairing: PairingProgress | null, now: number): string | null {
	switch (pairing?.phase) {
		case "scanning":
			return "Looking for Mappinator…";
		case "waiting":
			return `Approve in Mappinator · ${Math.max(0, Math.ceil((pairing.expiresAt - now) / 1000))}s`;
		case "denied":
			return "Pairing was denied.";
		case "expired":
			return "Pairing expired.";
		case "unreachable":
			return "Mappinator not found. Is Site connection on?";
		case "failed":
			return "Mappinator refused the request.";
		case "revoked":
			return "Access was revoked in Mappinator. Allow this site under Connection there, then connect again.";
		default:
			return null;
	}
}

const SOURCE_LABEL: Record<SourceState, string> = {
	available: "Available",
	unavailable: "Unavailable",
	not_configured: "Not set up",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex items-baseline justify-between gap-3 text-xs">
			<dt className="text-subtle-foreground">{label}</dt>
			<dd className="min-w-0 truncate text-right text-foreground">{children}</dd>
		</div>
	);
}

function ConnectionCard() {
	const hydrated = useSyncHydrated();
	const connection = useCompanionSyncStore((state) => state.connection);
	const status = useCompanionSyncStore((state) => state.status);
	const pairing = useCompanionSyncStore((state) => state.pairing);
	const lastSyncAt = useCompanionSyncStore((state) => state.lastSyncAt);
	const raid = useCompanionSyncStore((state) => state.raid);
	const position = useCompanionSyncStore((state) => state.position.latest);
	const companion = useCompanionSyncStore((state) => state.companionStatus);
	const now = useNow(1000);
	const token = connection?.token;
	const port = connection?.port;

	// Fetch app details on open and after each successful sync while this page is mounted.
	useEffect(() => {
		if (!hydrated || !token || port === undefined) return;
		let cancelled = false;
		void getStatus(port, token).then((result) => {
			if (!cancelled && result.kind === "ok") useCompanionSyncStore.getState().setCompanionStatus(result.data);
		});
		return () => {
			cancelled = true;
		};
	}, [hydrated, token, port, lastSyncAt]);

	const busy = pairing?.phase === "scanning" || pairing?.phase === "waiting";
	const pairingText = pairingMessage(pairing, now);
	const connected = hydrated && !!connection && status !== "revoked";

	let dot = "bg-subtle-foreground";
	let label = "Not connected";
	if (!hydrated) label = "Loading…";
	else if (busy) {
		dot = "bg-warning";
		label = "Pairing";
	} else if (connection) {
		if (status === "revoked") {
			dot = "bg-danger";
			label = "Access revoked";
		} else if (status === "unreachable") {
			dot = "bg-danger";
			label = "Unreachable";
		} else if (status === "connected") {
			dot = "bg-success";
			label = "Connected";
		} else {
			dot = "bg-warning";
			label = "Connecting";
		}
	}

	const inRaid = raid && raid.phase !== "ended";
	const raidMode = raid ? profileForMode(raid.mode, "") : null;

	return (
		<section aria-label="Connection" className="rounded-lg border border-highlight/10 bg-card p-4">
			<div className="flex items-center gap-2">
				<span className={cn("size-2 shrink-0 rounded-full", dot)} aria-hidden="true" />
				<p className="text-sm font-medium text-foreground">{label}</p>
				{connected && status === "connected" && lastSyncAt && (
					<p className="ml-auto text-xs text-subtle-foreground">synced {relativeAge(lastSyncAt, now)}</p>
				)}
			</div>

			{connected && (
				<dl className="mt-3 space-y-1.5">
					{companion && <Row label="App">Mappinator v{companion.version}</Row>}
					{companion?.scanner_running !== undefined && (
						<Row label="Scanner">{companion.scanner_running ? "Running" : "Stopped"}</Row>
					)}
					{companion?.logs && <Row label="Logs">{SOURCE_LABEL[companion.logs]}</Row>}
					{companion?.screenshots && <Row label="Screenshots">{SOURCE_LABEL[companion.screenshots]}</Row>}
					<Row label="Current raid">
						{inRaid ? (
							<span className="inline-flex items-center gap-1.5">
								{[raid.map ? mapDisplayName({ raw: raid.map.raw, normalizedName: raid.map.normalized_name }) : null, raid.phase === "loading" ? "Loading" : "In raid"]
									.filter(Boolean)
									.join(" · ")}
								{raidMode && (
									<Badge variant="flat" size="xs" tone="neutral">
										{describeProfile(raidMode)}
									</Badge>
								)}
							</span>
						) : (
							<span className="text-subtle-foreground">Not in raid</span>
						)}
					</Row>
					{position && (
						<Row label="Last position">
							{[
								position.map ? mapDisplayName({ raw: position.map.raw, normalizedName: position.map.normalized_name }) : null,
								relativeAge(position.captured_at, now),
							]
								.filter(Boolean)
								.join(" · ")}
						</Row>
					)}
				</dl>
			)}

			{hydrated && (
				<div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
					{busy ? (
						<p className="text-xs text-warning">{pairingText}</p>
					) : (
						<>
							{(!connection || status === "revoked") && (
								<button type="button" onClick={() => void connectCompanion()} className={PRIMARY_BUTTON}>
									Connect
								</button>
							)}
							{connection && status !== "revoked" && (
								<button type="button" onClick={() => void runSyncOnce()} className={PRIMARY_BUTTON}>
									Sync now
								</button>
							)}
							{connection && (
								<button type="button" onClick={() => void disconnectCompanion()} className={LINK_BUTTON}>
									Disconnect
								</button>
							)}
						</>
					)}
				</div>
			)}
			{hydrated && !busy && pairingText && <p className="mt-2 text-xs text-warning">{pairingText}</p>}
		</section>
	);
}

function SummarySection() {
	const hydrated = useSyncHydrated();
	const feed = useCompanionSyncStore((state) => state.feed);
	const unknownMode = useCompanionSyncStore((state) => state.unknownMode);

	const totals = useMemo(() => {
		const byProfile = new Map<string, { applied: number; waiting: number; review: number }>();
		for (const entry of feed) {
			if (!entry.profile || entry.kind !== "quest") continue;
			const row = byProfile.get(entry.profile) ?? { applied: 0, waiting: 0, review: 0 };
			if (entry.status === "applied") row.applied += 1;
			else if (entry.status === "waiting") row.waiting += 1;
			else if (entry.status === "review") row.review += 1;
			byProfile.set(entry.profile, row);
		}
		return [...byProfile.entries()].sort(([a], [b]) => a.localeCompare(b));
	}, [feed]);

	return (
		<div className="space-y-6">
			{hydrated && totals.length > 0 && (
				<section aria-label="Totals" className="space-y-2">
					<div className="grid grid-cols-[1fr_repeat(3,auto)] gap-x-4 gap-y-1 text-xs">
						<span />
						<span className="text-right text-subtle-foreground">Applied</span>
						<span className="text-right text-subtle-foreground">Waiting</span>
						<span className="text-right text-subtle-foreground">Review</span>
						{totals.map(([profile, row]) => (
							<div key={profile} className="contents">
								<span className="font-medium text-foreground">{describeProfile(profile)}</span>
								<span className="text-right tabular-nums text-foreground">{row.applied}</span>
								<span className="text-right tabular-nums text-foreground">{row.waiting}</span>
								<span className="text-right tabular-nums text-foreground">{row.review}</span>
							</div>
						))}
					</div>
					{unknownMode > 0 && (
						<p className="text-xs text-subtle-foreground">{unknownMode} with unknown mode</p>
					)}
				</section>
			)}
			{hydrated && totals.length === 0 && unknownMode > 0 && (
				<p className="text-xs text-subtle-foreground">{unknownMode} with unknown mode</p>
			)}
			<section aria-labelledby="sync-download" className="space-y-1">
				<h2 id="sync-download" className={SECTION_TITLE}>
					Download
				</h2>
				<p className="text-sm text-muted-foreground">Coming soon</p>
			</section>
		</div>
	);
}
