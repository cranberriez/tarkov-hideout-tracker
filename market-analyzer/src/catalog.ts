import { intervalDue } from "./schedule";

export const CATALOG_REFRESH_MS = 2 * 60 * 60 * 1000;
export const CATALOG_RETRY_MS = 15 * 60 * 1000;

export interface CatalogState {
	lastSuccessAt: number | null;
	lastAttemptAt: number | null;
}

/** One all-mode job, independent of the per-mode price schedules. */
export async function runCatalogIfDue<T>(dependencies: {
	load: () => CatalogState;
	save: (state: CatalogState) => void;
	refresh: () => Promise<T>;
	now: () => number;
}): Promise<T | undefined> {
	const state = dependencies.load();
	const now = dependencies.now();
	if (
		!intervalDue(state.lastSuccessAt, CATALOG_REFRESH_MS, now) ||
		!intervalDue(state.lastAttemptAt, CATALOG_RETRY_MS, now)
	)
		return;
	dependencies.save({ ...state, lastAttemptAt: now });
	const result = await dependencies.refresh();
	dependencies.save({ lastAttemptAt: now, lastSuccessAt: dependencies.now() });
	return result;
}
