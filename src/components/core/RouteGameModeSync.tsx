"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Layers } from "lucide-react";
import { switchModeHref } from "@/lib/entity-routes";
import { GAME_MODE_CONFIG, type GameMode } from "@/lib/game-mode";
import { getCurrentSeason } from "@/lib/cfg/seasons";
import { useUserStoreHydrated } from "@/lib/query/game-data";
import { useUserStore } from "@/lib/stores/useUserStore";

/** KORD can only become active once a seasonal character exists; activation stays an explicit action. */
function canFollowRoute(mode: GameMode, state: ReturnType<typeof useUserStore.getState>) {
	if (mode !== "KORD") return true;
	return !!(state.seasonalProfiles[getCurrentSeason().id] ?? state.seasonalProfiles[state.selectedSeasonId]);
}

/** Set by callers that switch profile and navigate themselves, so the sync does not navigate a second time. */
let callerNavigates = false;

/** Call before switching the active profile when the caller pushes its own mode-scoped URL right after. */
export function expectCallerModeNavigation() {
	callerNavigates = true;
}

/**
 * On mode-scoped pages the URL is the source of truth for the rendered dataset.
 * - When the URL's mode changes (navigation, back button, shared link) the active
 *   profile follows it through `setGameMode`, which saves and loads profiles
 *   without discarding progress. A KORD URL without a seasonal character does not
 *   switch; a banner offers activation or the active mode instead.
 * - When the active profile changes while the URL stays (profile menu, setup,
 *   quest import, another tab) the page navigates to the same path in that mode.
 * Comparing against the previous values keeps the two directions from fighting.
 */
export function RouteGameModeSync({ mode }: { mode: GameMode }) {
	const hydrated = useUserStoreHydrated();
	const storeMode = useUserStore((state) => state.gameMode);
	const router = useRouter();
	const pathname = usePathname();
	const canFollow = useUserStore((state) => canFollowRoute(mode, state));
	const previous = useRef<{ route: GameMode; store: GameMode } | null>(null);

	useEffect(() => {
		if (!hydrated) return;
		const last = previous.current;
		previous.current = { route: mode, store: storeMode };
		if (storeMode === mode) {
			callerNavigates = false;
			return;
		}
		if (!last || last.route !== mode) {
			if (canFollowRoute(mode, useUserStore.getState())) useUserStore.getState().setGameMode(mode);
			return;
		}
		if (last.store !== storeMode) {
			if (callerNavigates) {
				callerNavigates = false;
				return;
			}
			router.push(switchModeHref(pathname, window.location.search, storeMode));
		}
	}, [hydrated, mode, storeMode, router, pathname]);

	if (!hydrated || storeMode === mode || canFollow) return null;
	const season = getCurrentSeason();
	return (
		<aside aria-label="Game mode" className="border-b border-brand/25 bg-brand/10">
			<div className="container mx-auto flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6">
				<div className="flex items-start gap-2 text-sm text-foreground sm:items-center">
					<Layers aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand sm:mt-0" />
					<p className="leading-5">
						<span className="font-semibold">This page shows {GAME_MODE_CONFIG[mode].label} data.</span> You
						don&apos;t have a {season.name} character yet.
					</p>
				</div>
				<div className="ml-6 flex shrink-0 items-center gap-2 sm:ml-0">
					<Link
						href={switchModeHref(pathname, "", storeMode)}
						className="rounded px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-highlight/5 hover:text-foreground"
					>
						View {GAME_MODE_CONFIG[storeMode].label} instead
					</Link>
					<button
						type="button"
						onClick={() => useUserStore.getState().activateSeason()}
						className="rounded bg-brand px-2.5 py-1 text-xs font-semibold text-inverse transition-colors hover:bg-brand-hover"
					>
						Start {season.name} character
					</button>
				</div>
			</div>
		</aside>
	);
}
