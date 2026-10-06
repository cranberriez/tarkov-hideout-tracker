"use client";
import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
const fallback = new Map<string, string>();
function read(key: string): string | null {
	if (typeof window === "undefined") return null;
	if (fallback.has(key)) return fallback.get(key)!;
	try {
		return window.localStorage.getItem(key);
	} catch {
		return null;
	}
}
function subscribe(listener: () => void) {
	listeners.add(listener);
	const onStorage = (event: StorageEvent) => {
		if (event.key) fallback.delete(event.key);
		else fallback.clear();
		listener();
	};
	window.addEventListener("storage", onStorage);
	return () => {
		listeners.delete(listener);
		window.removeEventListener("storage", onStorage);
	};
}
/** No mount-time writes; synchronizes consumers without overwriting another mode. */
export function useStoredProfitValue(key: string) {
	const raw = useSyncExternalStore(
		subscribe,
		() => read(key),
		() => null,
	);
	const update = useCallback(
		(transform: (current: string | null) => string) => {
			const value = transform(read(key));
			try {
				window.localStorage.setItem(key, value);
				fallback.delete(key);
			} catch {
				fallback.set(key, value);
			}
			for (const listener of listeners) listener();
		},
		[key],
	);
	return [raw, update] as const;
}
