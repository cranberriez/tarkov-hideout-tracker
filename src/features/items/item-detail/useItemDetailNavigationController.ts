"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useUIStore } from "@/lib/stores/useUIStore";
import { useUserStore } from "@/lib/stores/useUserStore";
import { createItemDetailNavigation, emptyItemNavigation } from "./item-detail-navigation";

/** Mounted with the global dialog, before the lazy detail UI or its requests load. */
export function useItemDetailNavigationController() {
	const [navigation] = useState(createItemDetailNavigation);
	const snapshot = useSyncExternalStore(navigation.subscribe, navigation.getSnapshot, () => emptyItemNavigation);
	const pathname = usePathname();
	const search = useSearchParams().toString();

	useEffect(() => {
		navigation.connect(
			{
				state: () => window.history.state,
				href: () => window.location.href,
				push: (state) => window.history.pushState(state, ""),
				replace: (state) => window.history.replaceState(state, ""),
				go: (delta) => window.history.go(delta),
				newSessionId: () => crypto.randomUUID(),
			},
			useUserStore.getState().gameMode,
		);

		let restoring = false;
		const unsubscribeNavigation = navigation.subscribe(() => {
			restoring = true;
			try {
				const entry = navigation.getSnapshot().entry;
				const store = useUIStore.getState();
				if (entry) store.showItemDetailEntry(entry);
				else store.closeItemDetail();
			} finally {
				restoring = false;
			}
		});
		const unsubscribeUI = useUIStore.subscribe((state, previous) => {
			if (restoring || state.itemDetailEntry === previous.itemDetailEntry) return;
			if (state.itemDetailEntry) navigation.open(state.itemDetailEntry);
			else navigation.close();
		});
		const unsubscribeMode = useUserStore.subscribe((state, previous) => {
			if (state.gameMode !== previous.gameMode) navigation.changeMode(state.gameMode);
		});
		window.addEventListener("popstate", navigation.restore);
		window.addEventListener("hashchange", navigation.routeChanged);
		const initialEntry = useUIStore.getState().itemDetailEntry;
		if (initialEntry) navigation.open(initialEntry);
		return () => {
			window.removeEventListener("popstate", navigation.restore);
			window.removeEventListener("hashchange", navigation.routeChanged);
			unsubscribeNavigation();
			unsubscribeUI();
			unsubscribeMode();
		};
	}, [navigation]);

	useEffect(() => navigation.routeChanged(), [pathname, search, navigation]);

	return { ...snapshot, back: navigation.back, close: navigation.close };
}
