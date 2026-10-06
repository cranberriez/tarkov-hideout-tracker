"use client";

import { useSyncExternalStore } from "react";

const COMPACT_QUERY = "(max-width: 1023px)";

/** Matches the ProfitTable.module.css card breakpoint so behaviour follows the rendered layout. */
export function useCompactCards() {
	return useSyncExternalStore(
		(onChange) => {
			const query = window.matchMedia(COMPACT_QUERY);
			query.addEventListener("change", onChange);
			return () => query.removeEventListener("change", onChange);
		},
		() => window.matchMedia(COMPACT_QUERY).matches,
		() => false,
	);
}
