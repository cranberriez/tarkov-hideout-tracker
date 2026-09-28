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
				const item = navigation.getSnapshot().item;
				const store = useUIStore.getState();
				if (item) store.openItemDetail(item);
				else store.closeItemDetail();
			} finally {
				restoring = false;
			}
		});
		const unsubscribeUI = useUIStore.subscribe((state, previous) => {
			if (restoring || state.itemDetailItem === previous.itemDetailItem) return;
			if (state.itemDetailItem) navigation.open(state.itemDetailItem);
			else navigation.close();
		});
		const unsubscribeMode = useUserStore.subscribe((state, previous) => {
			if (state.gameMode !== previous.gameMode) navigation.changeMode(state.gameMode);
		});
		window.addEventListener("popstate", navigation.restore);
		window.addEventListener("hashchange", navigation.routeChanged);
		const initialItem = useUIStore.getState().itemDetailItem;
		if (initialItem) navigation.open(initialItem);
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
