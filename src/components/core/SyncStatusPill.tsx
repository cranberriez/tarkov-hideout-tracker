"use client";

import Link from "next/link";

import { mapDisplayName } from "@/features/sync/sync-model";
import { useSyncHydrated } from "@/features/sync/useSyncHydrated";
import { useCompanionSyncStore } from "@/lib/stores/useCompanionSyncStore";

/** Navbar link to /sync while the Mappinator companion is connected. Dot only below `sm`. */
export function SyncStatusPill() {
	const hydrated = useSyncHydrated();
	const live = useCompanionSyncStore((state) => !!state.connection && state.status === "connected");
	const raid = useCompanionSyncStore((state) => state.raid);
	if (!hydrated || !live) return null;
	const map =
		raid && (raid.phase === "loading" || raid.phase === "in_raid") && raid.map
			? mapDisplayName({ raw: raid.map.raw, normalizedName: raid.map.normalized_name })
			: null;
	const label = map ? `Mappinator sync: connected, in raid on ${map}` : "Mappinator sync: connected";
	return (
		<Link
			href="/sync"
			title={label}
			aria-label={label}
			className="flex h-10 shrink-0 items-center gap-2 rounded border border-highlight/10 bg-shadow/35 px-2.5 text-foreground transition-colors hover:border-brand/50 focus-visible:outline-2 focus-visible:outline-brand"
		>
			<span className="h-2 w-2 shrink-0 rounded-full bg-success" aria-hidden="true" />
			<span className="hidden text-sm font-semibold leading-none sm:inline">{map ?? "Sync"}</span>
		</Link>
	);
}
