"use client";

import { useSyncExternalStore } from "react";
import { useCompanionSyncStore } from "@/lib/stores/useCompanionSyncStore";
import { useUserStore } from "@/lib/stores/useUserStore";

function subscribe(notify: () => void) {
	const offUser = useUserStore.persist.onFinishHydration(notify);
	const offSync = useCompanionSyncStore.persist.onFinishHydration(notify);
	return () => {
		offUser();
		offSync();
	};
}

/** True once both the user store and the companion sync store have loaded from storage. */
export function useSyncHydrated(): boolean {
	return useSyncExternalStore(
		subscribe,
		() => useUserStore.persist.hasHydrated() && useCompanionSyncStore.persist.hasHydrated(),
		() => false,
	);
}
