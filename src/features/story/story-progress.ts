import type { StoryEndingId } from "@/types/story";

/**
 * Story progress for one mode, stored in `tarkov-story-progress-v1:{mode}`.
 * Unknown step/decision IDs are kept so data edits never silently drop progress.
 */
export interface StoryProgress {
	targetEnding: StoryEndingId | null;
	/** null until the player answers; Lightkeeper-only steps are flagged when false. */
	lightkeeperAccess: boolean | null;
	/** Decision ID → chosen option ID. */
	decisions: Record<string, string>;
	/** Chapter ID → completed step IDs. */
	completedSteps: Record<string, string[]>;
}

export const STORY_PROGRESS_VERSION = 1;
const ENDING_IDS: readonly string[] = ["savior", "debtor", "survivor", "fallen"];

export function emptyStoryProgress(): StoryProgress {
	return { targetEnding: null, lightkeeperAccess: null, decisions: {}, completedSteps: {} };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Tolerant reader: malformed fields fall back to defaults without discarding valid ones. */
export function parseStoryProgress(raw: string | null): StoryProgress {
	const progress = emptyStoryProgress();
	if (!raw) return progress;
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return progress;
	}
	if (!isRecord(parsed)) return progress;

	if (typeof parsed.targetEnding === "string" && ENDING_IDS.includes(parsed.targetEnding)) {
		progress.targetEnding = parsed.targetEnding as StoryEndingId;
	}
	if (typeof parsed.lightkeeperAccess === "boolean") progress.lightkeeperAccess = parsed.lightkeeperAccess;
	if (isRecord(parsed.decisions)) {
		for (const [decisionId, optionId] of Object.entries(parsed.decisions)) {
			if (typeof optionId === "string") progress.decisions[decisionId] = optionId;
		}
	}
	if (isRecord(parsed.completedSteps)) {
		for (const [chapterId, stepIds] of Object.entries(parsed.completedSteps)) {
			if (!Array.isArray(stepIds)) continue;
			const valid = [...new Set(stepIds.filter((stepId): stepId is string => typeof stepId === "string"))];
			if (valid.length > 0) progress.completedSteps[chapterId] = valid;
		}
	}
	return progress;
}

export function serializeStoryProgress(progress: StoryProgress): string {
	return JSON.stringify({ version: STORY_PROGRESS_VERSION, ...progress });
}

export function toggleStoryStep(progress: StoryProgress, chapterId: string, stepId: string): StoryProgress {
	const current = progress.completedSteps[chapterId] ?? [];
	const next = current.includes(stepId) ? current.filter((id) => id !== stepId) : [...current, stepId];
	const completedSteps = { ...progress.completedSteps, [chapterId]: next };
	if (next.length === 0) delete completedSteps[chapterId];
	return { ...progress, completedSteps };
}

/** Choosing the selected option again clears the decision. */
export function toggleStoryDecision(progress: StoryProgress, decisionId: string, optionId: string): StoryProgress {
	const decisions = { ...progress.decisions };
	if (decisions[decisionId] === optionId) delete decisions[decisionId];
	else decisions[decisionId] = optionId;
	return { ...progress, decisions };
}
