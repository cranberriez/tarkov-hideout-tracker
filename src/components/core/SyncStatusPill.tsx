"use client";

import Link from "next/link";

import { mapDisplayName } from "@/features/sync/sync-model";
import { useSyncHydrated } from "@/features/sync/useSyncHydrated";
import { useCompanionSyncStore } from "@/lib/stores/useCompanionSyncStore";

const STATUS_DISPLAY: Record<"connected" | "connecting" | "unreachable" | "revoked", { dot: string; text: string }> = {
	connected: { dot: "bg-success", text: "connected" },
	connecting: { dot: "bg-warning", text: "connecting" },
	unreachable: { dot: "bg-warning", text: "waiting for Mappinator" },
	revoked: { dot: "bg-danger", text: "access revoked" },
};

/** Navbar link to /sync showing companion sync status until it is disconnected. Dot only below `sm`. */
export function SyncStatusPill() {
	const hydrated = useSyncHydrated();
	const status = useCompanionSyncStore((state) => state.status);
	const hasConnection = useCompanionSyncStore((state) => !!state.connection);
	const raid = useCompanionSyncStore((state) => state.raid);
	if (!hydrated) return null;
	const kind =
		status === "revoked"
			? "revoked"
			: status === "pairing"
				? "connecting"
				: hasConnection
					? status === "unreachable"
						? "unreachable"
						: "connected"
					: null;
	if (!kind) return null;
	const display = STATUS_DISPLAY[kind];
	const map =
		kind === "connected" && raid && (raid.phase === "loading" || raid.phase === "in_raid") && raid.map
			? mapDisplayName({ raw: raid.map.raw, normalizedName: raid.map.normalized_name })
			: null;
	const label = map ? `Mappinator sync: connected, in raid on ${map}` : `Mappinator sync: ${display.text}`;
	return (
		<Link
			href="/sync"
			title={label}
			aria-label={label}
			className="flex h-10 shrink-0 items-center gap-2 rounded border border-highlight/10 bg-shadow/35 px-2.5 text-foreground transition-colors hover:border-brand/50 focus-visible:outline-2 focus-visible:outline-brand"
		>
			<span className={`h-2 w-2 shrink-0 rounded-full ${display.dot}`} aria-hidden="true" />
			<span className="hidden text-sm font-semibold leading-none sm:inline">{map ?? "Sync"}</span>
		</Link>
	);
}
