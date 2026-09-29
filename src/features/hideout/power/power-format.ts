"use client";

import { useSyncExternalStore } from "react";
import { formatCompactRoubles } from "@/lib/utils/market-price";

/** "45m", "27h 35m", or "3d 11h" once past two days. */
export function formatSpan(seconds: number): string {
	const totalMinutes = Math.max(0, Math.round(seconds / 60));
	const hours = Math.floor(totalMinutes / 60);
	if (hours >= 48) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
	return hours > 0 ? `${hours}h ${totalMinutes % 60}m` : `${totalMinutes}m`;
}

export function formatRoubles(value: number | null | undefined): string {
	return value == null ? "—" : `${formatCompactRoubles(value)} ₽`;
}

let minuteNow = Date.now();

function subscribeToMinutes(onChange: () => void) {
	minuteNow = Date.now();
	const timer = setInterval(() => {
		minuteNow = Date.now();
		onChange();
	}, 60_000);
	return () => clearInterval(timer);
}

/** Current time, refreshed each minute; null on the server and during hydration. */
export function useNow(): number | null {
	return useSyncExternalStore(
		subscribeToMinutes,
		() => minuteNow,
		() => null,
	);
}

export function formatClock(now: number, seconds: number): string {
	return new Date(now + seconds * 1000).toLocaleString(undefined, {
		weekday: "short",
		hour: "2-digit",
		minute: "2-digit",
	});
}
