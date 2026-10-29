import type { StoryChapter, StoryCondition, StoryDecision, StoryEndingId, StoryStep } from "@/types/story";
import { decisionLocations, evaluateCondition, resolveDecisions } from "./story-model";
import type { StoryProgress } from "./story-progress";

export interface StoryFailureCondition {
	id: string;
	chapterId: string;
	chapterName: string;
	href: string;
	title: string;
	text: string;
	kind: "route" | "setback" | "requirement";
	conditions: string[];
	quests: { id: string; name: string }[];
	status: "active" | "completed" | "passed" | "inapplicable" | "failed";
}

/** All authored risks for an ending, independent of recorded choices and completed steps. */
export function buildStoryFailureConditions(
	chapters: readonly StoryChapter[],
	decisions: readonly StoryDecision[],
	ending: StoryEndingId,
	progress?: StoryProgress | null,
	completedQuests: Readonly<Record<string, boolean>> = {},
): StoryFailureCondition[] {
	const resolved = resolveDecisions(decisions, {}, ending);
	// Only recorded choices establish that a risk has been passed, never ending implications.
	const recorded = resolveDecisions(decisions, progress?.decisions ?? {}, null);
	const describe = (condition: StoryCondition): string => {
		if ("decision" in condition) {
			const decision = decisions.find(({ id }) => id === condition.decision);
			const ids = Array.isArray(condition.is) ? condition.is : [condition.is];
			return `${decision?.prompt ?? condition.decision} — ${ids.map((id) => decision?.options.find((option) => option.id === id)?.label ?? id).join(" or ")}`;
		}
		return ("all" in condition ? condition.all : condition.any)
			.map(describe)
			.join("all" in condition ? "; and " : "; or ");
	};
	const entries: StoryFailureCondition[] = [];
	for (const chapter of chapters) {
		const locations = decisionLocations(chapter);
		for (const decision of decisions.filter((candidate) => candidate.chapterId === chapter.id)) {
			if (evaluateCondition(decision.when, resolved) === false) continue;
			for (const option of decision.options) {
				if (!option.endings || option.endings.includes(ending)) continue;
				const location = locations.get(decision.id);
				const chosen = decision.options.find((candidate) => candidate.id === recorded[decision.id]?.optionId);
				const status =
					evaluateCondition(decision.when, recorded) === false
						? "inapplicable"
						: chosen?.id === option.id
							? "failed"
							: chosen && (!chosen.endings || chosen.endings.includes(ending))
								? "passed"
								: !chosen && location && progress?.completedSteps[chapter.id]?.includes(location.stepId)
									? "completed"
									: "active";
				entries.push({
					id: `choice:${decision.id}:${option.id}`,
					chapterId: chapter.id,
					chapterName: chapter.name,
					href: `/story/${chapter.id}${location ? `#step-${location.stepId}` : `#decision-${decision.id}`}`,
					title: decision.prompt,
					text: `Choosing “${option.label}” rules out this ending.`,
					kind: "route",
					conditions: decision.when ? [describe(decision.when)] : [],
					quests: [],
					status,
				});
			}
		}
		const visit = (step: StoryStep, inherited: StoryCondition[], ancestors: string[] = []) => {
			const conditions = step.when ? [...inherited, step.when] : inherited;
			if (conditions.some((condition) => evaluateCondition(condition, resolved) === false)) return;
			const base = {
				chapterId: chapter.id,
				chapterName: chapter.name,
				href: `/story/${chapter.id}#step-${step.id}`,
				title: step.text,
				conditions: conditions.map(describe),
			};
			const quests = [...(step.quests ?? []), ...(step.warningQuest ? [step.warningQuest] : [])];
			const failures = quests.filter((quest) => quest.failsEndings?.includes(ending));
			const required = quests.filter((quest) => quest.requiredForEndings?.includes(ending));
			const status: StoryFailureCondition["status"] = failures.some((quest) => completedQuests[quest.id])
				? "failed"
				: conditions.some((condition) => evaluateCondition(condition, recorded) === false)
					? "inapplicable"
					: [step.id, ...ancestors].some((id) => progress?.completedSteps[chapter.id]?.includes(id))
						? "completed"
						: required.some((quest) => completedQuests[quest.id])
							? "passed"
							: "active";
			const failure = step.failureCondition;
			if (failures.length || ((failure || step.warning) && (!failure?.endings || failure.endings.includes(ending)))) {
				entries.push({
					...base,
					id: `objective:${chapter.id}:${step.id}`,
					text:
						failure?.text ??
						step.warning ??
						`Completing ${failures.map((quest) => quest.name).join(" or ")} rules out this ending.`,
					kind: failures.length ? "route" : (failure?.kind ?? "setback"),
					quests: failures,
					status,
				});
			}
			if (required.length)
				entries.push({
					...base,
					id: `requirement:${chapter.id}:${step.id}`,
					text:
						required[0].requirementNote ?? `This route requires ${required.map((quest) => quest.name).join(" or ")}.`,
					kind: "requirement",
					quests: required,
					status,
				});
			step.substeps?.forEach((child) => visit(child, conditions, [...ancestors, step.id]));
		};
		for (const section of chapter.sections) {
			if (section.endings && !section.endings.includes(ending)) continue;
			section.steps.forEach((step) => visit(step, section.when ? [section.when] : []));
		}
	}
	return entries;
}

export function groupStoryFailureConditions(entries: readonly StoryFailureCondition[]) {
	const settled = (entry: StoryFailureCondition) => ["completed", "passed", "inapplicable"].includes(entry.status);
	return (["route", "objective", "resolved"] as const)
		.map((kind) => {
			const matching = entries.filter((entry) =>
				kind === "resolved"
					? settled(entry)
					: !settled(entry) && (kind === "route" ? entry.kind === "route" : entry.kind !== "route"),
			);
			const chapters = [...new Set(matching.map((entry) => entry.chapterId))].map((chapterId) => ({
				chapterId,
				chapterName: matching.find((entry) => entry.chapterId === chapterId)!.chapterName,
				entries: matching.filter((entry) => entry.chapterId === chapterId),
			}));
			return { kind, chapters };
		})
		.filter((group) => group.chapters.length);
}
