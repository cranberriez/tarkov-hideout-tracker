/**
 * Personal modifier builder totals. A character starts at 0 points: negatives grant points,
 * positives spend them, and a build is valid while the balance stays at 0 or above.
 * `points` uses the posters' sign (positives negative, negatives positive).
 */
export type BuilderTotals = {
	granted: number;
	spent: number;
	balance: number;
	valid: boolean;
	count: number;
};

/** Legacy readable share query, e.g. `?picks=lockpicker,extrovert`; still read, rewritten to `?b=`. */
export const PICKS_PARAM = "picks";
/** Compact share query: a base64url bitmask over the season's append-only `shareOrder`. */
export const BUILD_PARAM = "b";

/** Selected IDs → base64url bitmask (bit i = shareOrder[i]); trailing zero bytes are trimmed. */
export function encodeBuild(selected: ReadonlySet<string>, shareOrder: readonly string[]): string {
	const bytes = new Uint8Array(Math.ceil(shareOrder.length / 8));
	shareOrder.forEach((id, index) => {
		if (selected.has(id)) bytes[index >> 3] |= 1 << (index & 7);
	});
	let end = bytes.length;
	while (end > 0 && bytes[end - 1] === 0) end--;
	if (end === 0) return "";
	return btoa(String.fromCharCode(...bytes.subarray(0, end)))
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replace(/=+$/, "");
}

/** Base64url bitmask → selected IDs. Malformed codes and bits beyond `shareOrder` are ignored. */
export function decodeBuild(code: string | null, shareOrder: readonly string[]): Set<string> {
	const selected = new Set<string>();
	if (!code) return selected;
	let binary: string;
	try {
		binary = atob(code.replaceAll("-", "+").replaceAll("_", "/"));
	} catch {
		return selected;
	}
	for (let index = 0; index < shareOrder.length; index++) {
		const byte = binary.charCodeAt(index >> 3);
		if (byte && byte & (1 << (index & 7))) selected.add(shareOrder[index]);
	}
	return selected;
}

/**
 * The one canonical code for a build, or "" when the input is empty, malformed, longer than this
 * season's bitmask can be, or selects nothing. Equivalent inputs (padding, junk high bits) collapse
 * to one string, so cache keys such as link-preview image URLs stay deduplicated.
 */
export function canonicalBuild(code: string | null, shareOrder: readonly string[]): string {
	if (!code) return "";
	const maxLength = Math.ceil((Math.ceil(shareOrder.length / 8) * 4) / 3);
	if (code.length > maxLength || !/^[A-Za-z0-9_-]+$/.test(code)) return "";
	return encodeBuild(decodeBuild(code, shareOrder), shareOrder);
}

/** Selected IDs from a `picks` value, keeping only IDs this season knows (stale links stay safe). */
export function parsePicks(value: string | null, knownIds: readonly string[]): Set<string> {
	const known = new Set(knownIds);
	return new Set((value ?? "").split(",").filter((id) => known.has(id)));
}

/** The `picks` value for a selection in the season's list order, so equal builds share one URL. */
export function serializePicks(selected: ReadonlySet<string>, orderedIds: readonly string[]): string {
	return orderedIds.filter((id) => selected.has(id)).join(",");
}

export function builderTotals(selected: Iterable<string>, points: Record<string, number>): BuilderTotals {
	let granted = 0;
	let spent = 0;
	let count = 0;
	for (const id of selected) {
		const value = points[id];
		if (value === undefined) continue;
		count++;
		if (value > 0) granted += value;
		else spent -= value;
	}
	const balance = granted - spent;
	return { granted, spent, balance, valid: balance >= 0, count };
}
