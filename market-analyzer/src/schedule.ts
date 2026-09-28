export function intervalDue(last: number | null | undefined, intervalMs: number, now: number): boolean {
	return last == null || now - last >= intervalMs;
}

/**
 * Analytics periods align to UTC multiples of the period (00:00 and 12:00 for
 * 12 hours, 00:00 for a day), so observations are comparable across restarts.
 */
export function periodDue(last: number | null | undefined, periodMs: number, now: number): boolean {
	return last == null || Math.floor(now / periodMs) > Math.floor(last / periodMs);
}
