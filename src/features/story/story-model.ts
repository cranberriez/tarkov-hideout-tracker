import type {
	StoryChapter,
	StoryCondition,
	StoryDecision,
	StoryEndingId,
	StoryItemRef,
	StorySection,
	StoryStep,
} from "@/types/story";
import type { StoryProgress } from "./story-progress";

/** `unknown` means the condition depends on a decision that is not made or implied yet. */
export type Truth = true | false | "unknown";

export interface ResolvedDecision {
	/** null when the decision cannot come up on this route. */
	optionId: string | null;
	/** Chosen by the player, the only option compatible with the target ending, or not applicable. */
	source: "chosen" | "implied" | "inapplicable";
}

export type ResolvedDecisions = Readonly<Record<string, ResolvedDecision>>;

export function evaluateCondition(condition: StoryCondition | undefined, resolved: ResolvedDecisions): Truth {
	if (!condition) return true;
	if ("decision" in condition) {
		const entry = resolved[condition.decision];
		if (!entry) return "unknown";
		const option = entry.optionId;
		if (option === null) return false;
		return Array.isArray(condition.is) ? condition.is.includes(option) : condition.is === option;
	}
	const results = ("all" in condition ? condition.all : condition.any).map((part) => evaluateCondition(part, resolved));
	const decisive = "all" in condition ? false : true;
	if (results.includes(decisive)) return decisive;
	return results.includes("unknown") ? "unknown" : !decisive;
}

function conditionDecisionIds(condition: StoryCondition | undefined, into: Set<string>) {
	if (!condition) return into;
	if ("decision" in condition) into.add(condition.decision);
	else for (const part of "all" in condition ? condition.all : condition.any) conditionDecisionIds(part, into);
	return into;
}

function compatibleOptions(decision: StoryDecision, ending: StoryEndingId) {
	return decision.options.filter((option) => !option.endings || option.endings.includes(ending));
}

/**
 * Applies decisions in order (dependencies first). Choices for decisions that no
 * longer apply are ignored, not deleted, so undoing an earlier choice restores them.
 */
export function resolveDecisions(
	decisions: readonly StoryDecision[],
	chosen: Readonly<Record<string, string>>,
	targetEnding: StoryEndingId | null,
): ResolvedDecisions {
	const resolved: Record<string, ResolvedDecision> = {};
	for (const decision of decisions) {
		if (evaluateCondition(decision.when, resolved) === false) {
			resolved[decision.id] = { optionId: null, source: "inapplicable" };
			continue;
		}
		const choice = chosen[decision.id];
		if (choice && decision.options.some((option) => option.id === choice)) {
			resolved[decision.id] = { optionId: choice, source: "chosen" };
			continue;
		}
		if (!targetEnding || !decision.options.some((option) => option.endings)) continue;
		const compatible = compatibleOptions(decision, targetEnding);
		if (compatible.length === 1) resolved[decision.id] = { optionId: compatible[0].id, source: "implied" };
	}
	return resolved;
}

/** Endings still possible given the player's own choices. */
export function reachableEndings(
	decisions: readonly StoryDecision[],
	chosen: Readonly<Record<string, string>>,
	endings: readonly StoryEndingId[],
): Set<StoryEndingId> {
	const resolved = resolveDecisions(decisions, chosen, null);
	const reachable = new Set(endings);
	for (const decision of decisions) {
		const option = decision.options.find((candidate) => candidate.id === resolved[decision.id]?.optionId);
		if (!option?.endings) continue;
		for (const ending of endings) if (!option.endings.includes(ending)) reachable.delete(ending);
	}
	return reachable;
}

export interface StepView {
	step: StoryStep;
	state: "active" | "pending";
	done: boolean;
	/** Needs Lightkeeper while the player has said they lack access. */
	lightkeeperBlocked: boolean;
	substeps: StepView[];
}

export interface SectionView {
	section: StorySection;
	state: "active" | "pending";
	/** Decisions that decide whether this section or some of its steps apply. */
	decisionIds: string[];
	/** The unresolved subset of `decisionIds`. */
	pendingOn: string[];
	steps: StepView[];
}

export interface StoryItemNeed {
	key: string;
	item: StoryItemRef;
}

export interface ChapterStats {
	requiredTotal: number;
	requiredDone: number;
	/** Required steps whose relevance depends on unresolved decisions. */
	pendingRequired: number;
	/** Remaining active steps that need Lightkeeper. */
	lightkeeperRemaining: number;
	/** Items for remaining active steps, deduplicated by item. */
	itemsNeeded: StoryItemNeed[];
}

export interface ChapterView {
	resolved: ResolvedDecisions;
	sections: SectionView[];
	stats: ChapterStats;
}

function buildStep(
	step: StoryStep,
	parentState: "active" | "pending",
	resolved: ResolvedDecisions,
	completed: ReadonlySet<string>,
	lacksLightkeeper: boolean,
): StepView | null {
	const truth = evaluateCondition(step.when, resolved);
	if (truth === false) return null;
	const state = parentState === "pending" || truth === "unknown" ? "pending" : "active";
	return {
		step,
		state,
		done: completed.has(step.id),
		lightkeeperBlocked: lacksLightkeeper && Boolean(step.requiresLightkeeper),
		substeps: (step.substeps ?? [])
			.map((substep) => buildStep(substep, state, resolved, completed, lacksLightkeeper))
			.filter((view): view is StepView => view !== null),
	};
}

function itemKey(item: StoryItemRef) {
	return item.id ?? `name:${item.name.toLowerCase()}`;
}

export function buildChapterView(
	chapter: StoryChapter,
	decisions: readonly StoryDecision[],
	progress: StoryProgress,
	targetEnding: StoryEndingId | null = progress.targetEnding,
): ChapterView {
	const resolved = resolveDecisions(decisions, progress.decisions, targetEnding);
	const completed = new Set(progress.completedSteps[chapter.id] ?? []);
	const lacksLightkeeper = progress.lightkeeperAccess === false;
	const stats: ChapterStats = {
		requiredTotal: 0,
		requiredDone: 0,
		pendingRequired: 0,
		lightkeeperRemaining: 0,
		itemsNeeded: [],
	};
	const items = new Map<string, StoryItemRef>();
	const addItems = (view: StepView) => {
		for (const item of view.step.items ?? []) {
			const key = itemKey(item);
			const existing = items.get(key);
			if (!existing || (item.count ?? 1) > (existing.count ?? 1)) items.set(key, item);
		}
	};

	const sections: SectionView[] = [];
	for (const section of chapter.sections) {
		const truth = evaluateCondition(section.when, resolved);
		if (truth === false) continue;
		const state = truth === "unknown" ? "pending" : "active";
		const steps = section.steps
			.map((step) => buildStep(step, state, resolved, completed, lacksLightkeeper))
			.filter((view): view is StepView => view !== null);
		const referenced = conditionDecisionIds(section.when, new Set());
		const collect = (step: StoryStep) => {
			conditionDecisionIds(step.when, referenced);
			step.substeps?.forEach(collect);
		};
		section.steps.forEach(collect);
		const decisionIds = [...referenced];
		const pendingOn = decisionIds.filter((id) => !resolved[id]);
		sections.push({ section, state, decisionIds, pendingOn, steps });

		for (const view of steps) {
			if (view.step.optional) continue;
			if (view.state === "pending") {
				stats.pendingRequired += 1;
				continue;
			}
			stats.requiredTotal += 1;
			if (view.done) {
				stats.requiredDone += 1;
				continue;
			}
			if (view.step.requiresLightkeeper) stats.lightkeeperRemaining += 1;
			addItems(view);
			for (const substep of view.substeps) if (substep.state === "active" && !substep.done) addItems(substep);
		}
	}
	stats.itemsNeeded = [...items].map(([key, item]) => ({ key, item }));
	return { resolved, sections, stats };
}

export interface DecisionLocation {
	sectionId: string;
	stepId: string;
	stepText: string;
}

/** Where each decision is made within a chapter, for decisions that have a step there. */
export function decisionLocations(chapter: StoryChapter): Map<string, DecisionLocation> {
	const locations = new Map<string, DecisionLocation>();
	const visit = (sectionId: string, step: StoryStep) => {
		if (step.decision && !locations.has(step.decision)) {
			locations.set(step.decision, { sectionId, stepId: step.id, stepText: step.text });
		}
		step.substeps?.forEach((substep) => visit(sectionId, substep));
	};
	for (const section of chapter.sections) for (const step of section.steps) visit(section.id, step);
	return locations;
}

/** Keep cross-chapter controls at their first authored section, even when that section is hidden. */
export function chapterStepGroups(chapter: StoryChapter, view: ChapterView) {
	const locations = decisionLocations(chapter);
	const placed = new Set<string>();
	const visible = new Map(view.sections.map((section) => [section.section.id, section]));
	return chapter.sections.map((section) => {
		const referenced = conditionDecisionIds(section.when, new Set<string>());
		const collect = (step: StoryStep) => {
			conditionDecisionIds(step.when, referenced);
			step.substeps?.forEach(collect);
		};
		section.steps.forEach(collect);
		const bars = [...referenced].filter((id) => {
			if (locations.has(id) || placed.has(id) || view.resolved[id]?.source === "inapplicable") return false;
			placed.add(id);
			return true;
		});
		return { sectionId: section.id, bars, view: visible.get(section.id) };
	});
}

/** Per-ending summary for the ending picker, using the player's choices plus that ending's implications. */
export function endingRouteStats(
	chapter: StoryChapter,
	decisions: readonly StoryDecision[],
	progress: StoryProgress,
	ending: StoryEndingId,
) {
	const { stats, sections } = buildChapterView(chapter, decisions, progress, ending);
	const needsLightkeeper = sections.some(
		(section) =>
			section.state === "active" &&
			section.steps.some((view) => view.state === "active" && !view.step.optional && view.step.requiresLightkeeper),
	);
	return {
		remaining: stats.requiredTotal - stats.requiredDone,
		pending: stats.pendingRequired,
		needsLightkeeper,
	};
}

export type EvidenceKind = "major" | "minor";

export interface EvidenceEntry {
	kind: EvidenceKind;
	item: StoryItemRef;
	/** The first step whose items include it, or null when no step matches. */
	stepId: string | null;
}

export interface ChapterEvidence {
	entries: EvidenceEntry[];
	/** The strongest evidence kind each step yields. */
	byStep: Map<string, EvidenceKind>;
}

/** Mr. Kerman's evidence found in this chapter, matched to its steps by item ID or name. */
export function chapterEvidence(
	chapter: StoryChapter,
	major: readonly StoryItemRef[],
	minor: readonly StoryItemRef[],
): ChapterEvidence {
	const stepByItem = new Map<string, string>();
	const visit = (step: StoryStep) => {
		for (const item of step.items ?? []) if (!stepByItem.has(itemKey(item))) stepByItem.set(itemKey(item), step.id);
		step.substeps?.forEach(visit);
	};
	for (const section of chapter.sections) section.steps.forEach(visit);

	const entries: EvidenceEntry[] = [];
	const byStep = new Map<string, EvidenceKind>();
	for (const [kind, items] of [
		["major", major],
		["minor", minor],
	] as const) {
		for (const item of items) {
			if (item.chapterId !== chapter.id) continue;
			const stepId = stepByItem.get(itemKey(item)) ?? null;
			entries.push({ kind, item, stepId });
			if (stepId && !byStep.has(stepId)) byStep.set(stepId, kind);
		}
	}
	return { entries, byStep };
}

/** How many pieces of each evidence kind the lists place in a chapter, tracked or not. */
export function evidenceCounts(chapterId: string, major: readonly StoryItemRef[], minor: readonly StoryItemRef[]) {
	return {
		major: major.filter((item) => item.chapterId === chapterId).length,
		minor: minor.filter((item) => item.chapterId === chapterId).length,
	};
}
