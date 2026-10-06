import { MAJOR_EVIDENCE, MINOR_EVIDENCE, STORY_CHAPTERS } from "../../lib/data/story";
import { chapterEvidence, type EvidenceEntry } from "./story-model";
import type { StoryProgress } from "./story-progress";

const chapterEntries = STORY_CHAPTERS.flatMap(
	(chapter) => chapterEvidence(chapter, MAJOR_EVIDENCE, MINOR_EVIDENCE).entries,
);

/** Keep unassigned evidence visible without inventing an acquisition objective. */
export const STORY_EVIDENCE: readonly EvidenceEntry[] = [
	...MAJOR_EVIDENCE.map((item) => ({ item, kind: "major" as const })),
	...MINOR_EVIDENCE.map((item) => ({ item, kind: "minor" as const })),
].map(({ item, kind }) => ({
	item,
	kind,
	stepId: chapterEntries.find((entry) => entry.item === item)?.stepId ?? null,
}));

export function isEvidenceFound(entry: EvidenceEntry, progress: StoryProgress | null): boolean {
	return Boolean(
		entry.item.chapterId && entry.stepId && progress?.completedSteps[entry.item.chapterId]?.includes(entry.stepId),
	);
}

export function majorEvidenceFound(progress: StoryProgress | null): number {
	return STORY_EVIDENCE.filter((entry) => entry.kind === "major" && isEvidenceFound(entry, progress)).length;
}
