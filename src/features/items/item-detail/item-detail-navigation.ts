import type { ItemSummary } from "@/types/items";

const HISTORY_KEY = "tarkovItemDialog";

interface HistoryEntry {
	session: string;
	index: number;
}

interface ItemSession {
	href: string;
	mode: string;
	items: ItemSummary[];
}

/** Browser effects are injected so navigation can be tested without React or a DOM. */
export interface ItemHistoryPort {
	state: () => unknown;
	href: () => string;
	push: (state: Record<string, unknown>) => void;
	replace: (state: Record<string, unknown>) => void;
	go: (delta: number) => void;
	newSessionId: () => string;
}

export interface ItemNavigationSnapshot {
	item: ItemSummary | null;
	previousItem: ItemSummary | null;
}

export const emptyItemNavigation: ItemNavigationSnapshot = { item: null, previousItem: null };

function stateRecord(state: unknown): Record<string, unknown> {
	return state && typeof state === "object" && !Array.isArray(state) ? (state as Record<string, unknown>) : {};
}

function readEntry(state: unknown): HistoryEntry | null {
	const entry = stateRecord(stateRecord(state)[HISTORY_KEY]);
	return typeof entry.session === "string" && Number.isSafeInteger(entry.index) && (entry.index as number) > 0
		? { session: entry.session, index: entry.index as number }
		: null;
}

/** Same-URL history entries contain only a token and position, never player data or item payloads. */
export function createItemDetailNavigation() {
	let port: ItemHistoryPort | null = null;
	let mode = "";
	let snapshot = emptyItemNavigation;
	let pendingTraversal = false;
	let queuedSelection: ItemSummary | null | undefined;
	const sessions = new Map<string, ItemSession>();
	const listeners = new Set<() => void>();

	function publish(item: ItemSummary | null, previousItem: ItemSummary | null = null) {
		if (snapshot.item === item && snapshot.previousItem === previousItem) return;
		snapshot = item ? { item, previousItem } : emptyItemNavigation;
		for (const listener of listeners) listener();
	}

	function currentEntry() {
		if (!port) return null;
		const entry = readEntry(port.state());
		const session = entry && sessions.get(entry.session);
		return entry && session && session.mode === mode && session.href === port.href() && session.items[entry.index - 1]
			? { entry, session }
			: null;
	}

	function clearUnknownMarker() {
		if (!port || !(HISTORY_KEY in stateRecord(port.state()))) return;
		const state = { ...stateRecord(port.state()) };
		delete state[HISTORY_KEY];
		port.replace(state);
	}

	function open(item: ItemSummary) {
		if (!port) return;
		if (pendingTraversal) {
			queuedSelection = item;
			return;
		}
		const current = currentEntry();
		if (current?.session.items[current.entry.index - 1].id === item.id) {
			current.session.items[current.entry.index - 1] = item;
			publish(item, current.session.items[current.entry.index - 2] ?? null);
			return;
		}
		const id = current?.entry.session ?? port.newSessionId();
		const session = current?.session ?? { href: port.href(), mode, items: [] };
		// Selecting a different item after Back discards that branch's forward entries.
		const items = [...session.items.slice(0, current?.entry.index ?? 0), item];
		port.push({ ...stateRecord(port.state()), [HISTORY_KEY]: { session: id, index: items.length } });
		sessions.set(id, { ...session, items });
		publish(item, items.at(-2) ?? null);
	}

	function close() {
		if (!port) return;
		if (pendingTraversal) {
			queuedSelection = null;
			return;
		}
		const current = currentEntry();
		if (current) {
			// Wait for popstate before exposing the page, so a route click cannot race this traversal.
			pendingTraversal = true;
			port.go(-current.entry.index);
		} else {
			publish(null);
		}
	}

	function restore() {
		pendingTraversal = false;
		const current = currentEntry();
		if (current) {
			publish(current.session.items[current.entry.index - 1], current.session.items[current.entry.index - 2] ?? null);
		} else {
			// A reload or mode change cannot revive item summaries from an earlier session.
			clearUnknownMarker();
			publish(null);
		}
		const queued = queuedSelection;
		queuedSelection = undefined;
		if (queued === null) close();
		else if (queued) open(queued);
	}

	return {
		getSnapshot: () => snapshot,
		subscribe(listener: () => void) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		connect(browser: ItemHistoryPort, gameMode: string) {
			port = browser;
			mode = gameMode;
			if (!currentEntry()) clearUnknownMarker();
		},
		open,
		close,
		back() {
			if (!port || pendingTraversal) return;
			if (currentEntry()) {
				pendingTraversal = true;
				port.go(-1);
			} else publish(null);
		},
		restore,
		routeChanged() {
			if (!pendingTraversal) restore();
		},
		changeMode(nextMode: string) {
			if (nextMode === mode) return;
			close();
			mode = nextMode;
			sessions.clear();
			queuedSelection = undefined;
			publish(null);
		},
	};
}
