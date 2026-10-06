"use client";

import { useEffect, useImperativeHandle, useState, type Ref } from "react";
import { Check, ChevronDown, CircleCheck, FileSearch, Gift, GitBranch, MapPin, TriangleAlert } from "lucide-react";
import { QuestLink } from "@/components/entities/quest-link";
import { Badge } from "@/components/ui/badge";
import { STORY_DECISION_BY_ID, STORY_ENDING_BY_ID, storyChapterLink } from "@/lib/data/story";
import { cn } from "@/lib/utils";
import type { StoryEndingId, StoryItemRef } from "@/types/story";
import type { chapterStepGroups, DecisionLocation, EvidenceKind, ResolvedDecisions, StepView } from "../story-model";
import { chapterDecisionTargets } from "../story-model";
import { ChapterBadge, StoryDecisionControl } from "./StoryDecisionControl";
import { StoryItemChip } from "./StoryItemChip";
import { StoryStepImages } from "./StoryStepImages";

interface StoryStepListProps {
	ref?: Ref<StoryStepListHandle>;
	chapterId: string;
	simplified?: boolean;
	groups: ReturnType<typeof chapterStepGroups>;
	resolved: ResolvedDecisions;
	targetEnding: StoryEndingId | null;
	locations: ReadonlyMap<string, DecisionLocation>;
	/** Steps that yield Mr. Kerman's evidence. */
	evidenceByStep: ReadonlyMap<string, EvidenceKind>;
	onToggleStep: (stepId: string, done: boolean) => void;
	onDecision: (decisionId: string, optionId: string) => void;
}

export interface StoryStepListHandle {
	jumpToDecision: (decisionId: string) => void;
}

/** Long item lists, such as evidence, start collapsed. */
const COLLAPSE_ITEMS_AFTER = 12;

export function StoryStepList({
	ref,
	simplified = false,
	chapterId,
	groups,
	resolved,
	targetEnding,
	locations,
	evidenceByStep,
	onToggleStep,
	onDecision,
}: StoryStepListProps) {
	const decisionProps = { chapterId, resolved, targetEnding, onDecision };
	const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
	// Evidence links arrive after the chapter's progress has hydrated and its steps mount.
	useEffect(() => {
		const jumpToEvidence = () => {
			if (!window.location.hash.startsWith("#step-")) return;
			const target = document.getElementById(window.location.hash.slice(1));
			target?.focus({ preventScroll: true });
			target?.scrollIntoView({ block: "center", behavior: "instant" });
		};
		const frame = requestAnimationFrame(jumpToEvidence);
		window.addEventListener("hashchange", jumpToEvidence);
		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener("hashchange", jumpToEvidence);
		};
	}, [chapterId]);
	const toggleSection = (sectionId: string) =>
		setCollapsed((current) => {
			const next = new Set(current);
			if (!next.delete(sectionId)) next.add(sectionId);
			return next;
		});
	/** Expands the section holding a choice before jumping to it. */
	const revealDecision = (decisionId: string, sectionId: string | undefined) => {
		if (sectionId && collapsed.has(sectionId)) toggleSection(sectionId);
		requestAnimationFrame(() => {
			const target = document.getElementById(`decision-${decisionId}`);
			target?.focus({ preventScroll: true });
			target?.scrollIntoView({
				behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
				block: "center",
			});
		});
	};
	useImperativeHandle(ref, () => ({
		jumpToDecision(decisionId) {
			const targets = chapterDecisionTargets(groups);
			if (targets.has(decisionId)) revealDecision(decisionId, targets.get(decisionId) ?? undefined);
		},
	}));
	return (
		<ol className="flex flex-col gap-6">
			{groups.map(({ sectionId, bars, view }) => {
				const controls = bars.map((decisionId) => (
					<StoryDecisionControl
						key={decisionId}
						id={`decision-${decisionId}`}
						decision={STORY_DECISION_BY_ID[decisionId]}
						layout="bar"
						{...decisionProps}
					/>
				));
				if (!view) {
					return bars.length ? (
						<li key={sectionId} className="space-y-4">
							{controls}
						</li>
					) : null;
				}
				const { section, state, decisionIds, pendingOn, steps } = view;
				const visibleSteps = simplified ? steps.filter(({ step }) => step.simplified !== false) : steps;
				if (!visibleSteps.length && !bars.length) return null;
				const isCollapsed = collapsed.has(section.id);
				const required = steps.filter((view) => !view.step.optional);
				const complete = required.length > 0 && required.every((view) => view.done);
				const links: Array<{ decisionId: string; label: string; sectionId?: string }> = [];
				for (const decisionId of decisionIds) {
					const location = locations.get(decisionId);
					if (location?.sectionId === section.id) continue;
					if (location) {
						if (pendingOn.includes(decisionId)) {
							links.push({
								decisionId,
								label: `Choose at “${location.stepText}”`,
								sectionId: location.sectionId,
							});
						}
					} else if (!bars.includes(decisionId) && pendingOn.includes(decisionId)) {
						links.push({ decisionId, label: "Choose above" });
					}
				}
				return (
					<li key={section.id}>
						{bars.length > 0 && <div className="mb-4 space-y-4">{controls}</div>}
						<div className="mb-2 flex flex-wrap items-center gap-2">
							<h2>
								<button
									type="button"
									onClick={() => toggleSection(section.id)}
									aria-expanded={!isCollapsed}
									className={cn(
										"inline-flex items-center gap-1.5 text-base font-semibold transition-colors hover:text-brand",
										state === "pending" ? "text-muted-foreground" : "text-foreground",
									)}
								>
									<ChevronDown
										aria-hidden="true"
										className={cn("size-4 transition-transform", isCollapsed && "-rotate-90")}
									/>
									{section.title}
									{isCollapsed && complete && <CircleCheck aria-label="Complete" className="size-4 text-success" />}
								</button>
							</h2>
							{section.endings?.map((ending) => (
								<img
									key={ending}
									src={STORY_ENDING_BY_ID[ending].image}
									alt={STORY_ENDING_BY_ID[ending].name}
									title={`${STORY_ENDING_BY_ID[ending].name} route`}
									className="size-5 object-contain"
								/>
							))}
							{links.map(({ decisionId, label, sectionId }) => (
								<a
									key={decisionId}
									href={`#decision-${decisionId}`}
									onClick={(event) => {
										event.preventDefault();
										revealDecision(decisionId, sectionId);
									}}
									title={STORY_DECISION_BY_ID[decisionId]?.prompt}
									className="inline-flex"
								>
									<Badge tone="info" variant="flat" size="sm" className="hover:bg-info/20">
										<GitBranch aria-hidden="true" />
										{label}
									</Badge>
								</a>
							))}
						</div>
						{!isCollapsed && (
							<ol
								className={cn(
									"flex flex-col rounded-md border border-highlight/10 bg-card",
									state === "pending" && "opacity-60",
								)}
							>
								{visibleSteps.map((view) => (
									<StepRow
										key={view.step.id}
										simplified={simplified}
										view={view}
										decisionProps={decisionProps}
										evidenceByStep={evidenceByStep}
										onToggleStep={onToggleStep}
									/>
								))}
							</ol>
						)}
					</li>
				);
			})}
		</ol>
	);
}

type DecisionProps = Pick<
	Parameters<typeof StoryDecisionControl>[0],
	"chapterId" | "resolved" | "targetEnding" | "onDecision"
>;

function StepRow({
	view,
	decisionProps,
	evidenceByStep,
	onToggleStep,
	nested = false,
	simplified = false,
}: {
	view: StepView;
	decisionProps: DecisionProps;
	evidenceByStep: ReadonlyMap<string, EvidenceKind>;
	onToggleStep: (stepId: string, done: boolean) => void;
	nested?: boolean;
	simplified?: boolean;
}) {
	const { step, done, state, lightkeeperBlocked, substeps } = view;
	const decision = step.decision ? STORY_DECISION_BY_ID[step.decision] : undefined;
	const optional = Boolean(step.optional);
	const evidence = evidenceByStep.get(step.id);
	const displayItems = simplified ? (step.simplifiedItems ?? step.items) : step.items;
	const detailedItems =
		!simplified ||
		(displayItems?.length ?? 0) > COLLAPSE_ITEMS_AFTER ||
		displayItems?.some((item) => item.note || item.chapterId);
	const displayText = simplified && typeof step.simplified === "string" ? step.simplified : step.text;
	const visibleSubsteps = simplified ? substeps.filter(({ step }) => step.simplified !== false) : substeps;
	return (
		<li
			id={`step-${step.id}`}
			tabIndex={-1}
			className={cn(
				"flex scroll-mt-24 gap-3 px-3 py-3",
				simplified && "py-2",
				nested ? "py-1.5 pl-0" : "border-b border-highlight/8 last:border-b-0",
				state === "pending" && !nested && "opacity-70",
			)}
		>
			<button
				type="button"
				onClick={() => onToggleStep(step.id, !done)}
				aria-pressed={done}
				aria-label={`${done ? "Mark as not done" : "Mark as done"}: ${displayText}`}
				className={cn(
					"mt-0.5 flex shrink-0 items-center justify-center rounded-full border transition-colors",
					nested ? "size-4" : "size-5",
					optional && !done && "border-dashed",
					done
						? "border-success/60 bg-success/20 text-success"
						: "border-highlight/25 text-transparent hover:border-brand/50 hover:text-brand/50",
				)}
			>
				<Check aria-hidden="true" className={nested ? "size-2.5" : "size-3"} strokeWidth={3} />
			</button>
			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center gap-1.5">
					{optional && (
						<Badge tone="info" variant="flat" size="sm">
							Optional
						</Badge>
					)}
					<span
						className={cn(
							nested ? "text-[13px] leading-5" : "text-[15px] leading-6",
							done ? "text-muted-foreground line-through" : optional ? "text-muted-foreground" : "text-foreground",
						)}
					>
						{displayText}
					</span>
					{step.map && (
						<Badge variant="flat" size="sm">
							<MapPin aria-hidden="true" />
							{step.map}
						</Badge>
					)}
					{evidence === "major" && (
						<Badge tone="special" variant="flat" size="md" title="Major evidence for Mr. Kerman in The Ticket">
							<FileSearch aria-hidden="true" />
							Major evidence
						</Badge>
					)}
					{evidence === "minor" && (
						<Badge variant="flat" size="sm" title="Optional minor evidence for Mr. Kerman in The Ticket">
							Minor evidence
						</Badge>
					)}
					{step.requiresLightkeeper && (
						<Badge tone={lightkeeperBlocked ? "danger" : "neutral"} variant="flat" size="sm">
							{lightkeeperBlocked ? <TriangleAlert aria-hidden="true" /> : null}
							Lightkeeper
						</Badge>
					)}
				</div>
				{(!simplified || !step.simplified) && step.note && (
					<p className="mt-1 text-[13px] leading-5 text-muted-foreground">{step.note}</p>
				)}
				{step.warning && (
					<p className="mt-1 flex items-start gap-1.5 text-[13px] leading-5 text-danger">
						<TriangleAlert aria-hidden="true" className="mt-[3px] size-3.5 shrink-0" />
						<span>
							{step.warningQuest
								? step.warning.split(step.warningQuest.name).map((part, index) => (
										<span key={index}>
											{index > 0 && (
												<QuestLink
													questId={step.warningQuest!.id}
													name={step.warningQuest!.name}
													className="font-semibold text-foreground underline underline-offset-2 hover:text-muted-foreground"
												>
													{step.warningQuest!.name}
												</QuestLink>
											)}
											{part}
										</span>
									))
								: step.warning}
						</span>
					</p>
				)}
				{step.quests && step.quests.length > 0 && (
					<div className="mt-2 flex flex-wrap items-center gap-2">
						{step.quests.map((quest) => (
							<QuestLink
								key={quest.id}
								questId={quest.id}
								name={quest.name}
								className="inline-flex items-center rounded-sm bg-highlight/10 px-3 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-highlight/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
							>
								{quest.name}
							</QuestLink>
						))}
					</div>
				)}
				<div className="mt-1.5 flex flex-wrap items-center gap-2">
					{simplified &&
						step.simplifiedRequirements?.map((requirement) => (
							<Badge key={requirement} variant="flat" size="sm" className="max-w-full shrink whitespace-normal">
								{requirement}
							</Badge>
						))}
					{detailedItems && displayItems && <StepItems items={displayItems} nested={nested} />}
					{!detailedItems &&
						displayItems?.map((item) => (
							<StoryItemChip key={item.id ?? item.name} item={item} size={nested ? "xs" : "sm"} />
						))}
					{step.images && step.images.length > 0 && (
						<StoryStepImages images={step.images} stepText={step.text} compact={simplified} />
					)}
					{step.rewardItems && step.rewardItems.length > 0 && (
						<div aria-label="Reward items" className="flex flex-wrap items-center gap-1.5 text-success">
							<Gift aria-hidden="true" className="size-3.5" />
							<StepItems items={step.rewardItems} nested={nested} />
						</div>
					)}
					{step.rewards && step.rewards.length > 0 && (
						<p className="flex items-start gap-1.5 text-[13px] leading-5 text-success">
							<Gift aria-hidden="true" className="mt-[3px] size-3.5 shrink-0" />
							{step.rewards.join(" · ")}
						</p>
					)}
				</div>
				{decision && (
					<StoryDecisionControl
						id={`decision-${decision.id}`}
						decision={decision}
						highlighted
						className="mt-2.5"
						{...decisionProps}
					/>
				)}
				{visibleSubsteps.length > 0 && (
					<ol className="mt-1.5 flex flex-col">
						{visibleSubsteps.map((substep) => (
							<StepRow
								key={substep.step.id}
								simplified={simplified}
								view={substep}
								decisionProps={decisionProps}
								evidenceByStep={evidenceByStep}
								onToggleStep={onToggleStep}
								nested
							/>
						))}
					</ol>
				)}
			</div>
		</li>
	);
}

function StepItems({ items, nested }: { items: StoryItemRef[]; nested: boolean }) {
	const detailed = items.some((item) => item.note || item.chapterId);
	if (!detailed) {
		return (
			<div className="mt-1.5 flex flex-wrap gap-1.5">
				{items.map((item) => (
					<StoryItemChip key={item.id ?? item.name} item={item} size={nested ? "xs" : "sm"} />
				))}
			</div>
		);
	}
	const list = (
		<ul className="mt-1.5 flex flex-col gap-1.5">
			{items.map((item) => {
				const source = item.chapterId ? storyChapterLink(item.chapterId) : null;
				return (
					<li key={item.id ?? item.name} className="flex items-center gap-2">
						<StoryItemChip item={item} size="xs" />
						<div className="min-w-0">
							<div className="flex flex-wrap items-center gap-1.5 text-[13px] text-foreground">
								{item.name}
								{source && <ChapterBadge {...source} />}
							</div>
							{item.note && <p className="text-xs leading-5 text-muted-foreground">{item.note}</p>}
						</div>
					</li>
				);
			})}
		</ul>
	);
	if (items.length <= COLLAPSE_ITEMS_AFTER) return list;
	return (
		<details className="mt-1.5 group">
			<summary className="cursor-pointer text-xs font-semibold text-muted-foreground hover:text-foreground">
				Show {items.length} items and where to find them
			</summary>
			{list}
		</details>
	);
}
