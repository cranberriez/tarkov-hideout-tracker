import config from "../data/game-releases.json";
import type { TarkovDataMode } from "../../types/common";

const modes: TarkovDataMode[] = ["regular", "pve", "pvp-season"];
type Release = { patch: string; name?: string; releasedAt: number; modes: TarkovDataMode[] };

export function parseReleaseTimeline(input: unknown): Release[] {
	if (!input || typeof input !== "object" || !("releases" in input) || !Array.isArray(input.releases)) {
		throw new Error("Release timeline must contain a releases array");
	}
	const seenDates = new Set<string>();
	const seenPatches = new Set<string>();
	return input.releases
		.map((entry: unknown) => {
			if (!entry || typeof entry !== "object") throw new Error("Invalid release timeline entry");
			const { patch, name, releasedAt, modes: selectedModes = modes } = entry as Record<string, unknown>;
			const beta = patch === "beta" && releasedAt === null;
			if (
				(!beta &&
					(typeof patch !== "string" ||
						!/^\d+\.\d+\.\d+\.\d+(?:\.\d+)?$/.test(patch) ||
						typeof releasedAt !== "string" ||
						!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(releasedAt) ||
						!Number.isFinite(Date.parse(releasedAt)) ||
						Date.parse(releasedAt) <= 0 ||
						new Date(releasedAt).toISOString() !== releasedAt.replace("Z", ".000Z"))) ||
				(name !== undefined && (typeof name !== "string" || !name.trim())) ||
				!Array.isArray(selectedModes) ||
				selectedModes.length === 0 ||
				selectedModes.some((mode) => !modes.includes(mode)) ||
				new Set(selectedModes).size !== selectedModes.length
			) {
				throw new Error("Release entries require a numeric patch, a valid UTC releasedAt timestamp, and valid modes");
			}
			for (const mode of selectedModes) {
				const dateKey = `${mode}:${releasedAt}`;
				const patchKey = `${mode}:${patch}`;
				if (seenDates.has(dateKey) || seenPatches.has(patchKey))
					throw new Error("Duplicate release date or patch for a mode");
				seenDates.add(dateKey);
				seenPatches.add(patchKey);
			}
			return {
				patch: patch as string,
				...(name ? { name: name as string } : {}),
				releasedAt: beta ? 0 : Date.parse(releasedAt as string),
				modes: selectedModes as TarkovDataMode[],
			};
		})
		.sort((a, b) => b.releasedAt - a.releasedAt);
}

export const RELEASE_TIMELINE = parseReleaseTimeline(config);

/** Resolve at read time so correcting dates never rewrites the first observation. */
export function resolveItemRelease(
	firstSeenAt: number | null | undefined,
	mode: TarkovDataMode,
	storedPatch?: string | null,
	legacyReleaseId?: string | null,
	timeline: readonly Release[] = RELEASE_TIMELINE,
): string | undefined {
	if (firstSeenAt == null) return storedPatch === "pre-1.1.5" ? storedPatch : undefined;
	const release = timeline.find((entry) => entry.modes.includes(mode) && entry.releasedAt <= firstSeenAt);
	// Old locally stamped patches may be stale; only imported provenance is a fallback.
	return release?.patch ?? (legacyReleaseId ? (storedPatch ?? undefined) : undefined);
}
