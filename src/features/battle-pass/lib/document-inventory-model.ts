import type { Progress } from "./battle-pass-model";

/** Patch the pass save without losing fields owned by another version of the viewer. */
export function mergeDocumentProgress(raw: string | null, patch: Partial<Progress>) {
	let saved: Record<string, unknown> = {};
	try {
		const value: unknown = JSON.parse(raw ?? "{}");
		if (value && typeof value === "object" && !Array.isArray(value)) saved = value as Record<string, unknown>;
	} catch {
		/* Keep the existing tolerant-read behavior. */
	}
	return JSON.stringify({ version: 1, ...saved, ...patch });
}
