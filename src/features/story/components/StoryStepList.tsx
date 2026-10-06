"use client";

import { useState } from "react";
import { Check, ChevronDown, CircleCheck, Gift, GitBranch, MapPin, ScrollText, TriangleAlert } from "lucide-react";
import { QuestLink } from "@/components/entities/quest-link";
import { Badge } from "@/components/ui/badge";
import { STORY_DECISION_BY_ID, STORY_ENDING_BY_ID, storyChapterLink } from "@/lib/data/story";
import { cn } from "@/lib/utils";
import type { StoryEndingId, StoryItemRef } from "@/types/story";
import type { DecisionLocation, ResolvedDecisions, SectionView, StepView } from "../story-model";
import { ChapterBadge, StoryDecisionControl } from "./StoryDecisionControl";
import { StoryItemChip } from "./StoryItemChip";

interface StoryStepListProps {
	chapterId: string;
	sections: SectionView[];
	resolved: ResolvedDecisions;
	targetEnding: StoryEndingId | null;
	locations: ReadonlyMap<string, DecisionLocation>;
	onToggleStep: (stepId: string, done: boolean) => void;
	onDecision: (decisionId: string, optionId: string) => void;
}

/** Long item lists, such as evidence, start collapsed. */
const COLLAPSE_ITEMS_AFTER = 12;

export function StoryStepList({
	chapterId,
	sections,
	resolved,
	targetEnding,
	locations,
	onToggleStep,
	onDecision,
}: StoryStepListProps) {
	const decisionProps = { chapterId, resolved, targetEnding, onDecision };
	const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
	const toggleSection = (sectionId: string) =>
		setCollapsed((current) => {
			const next = new Set(current);
			if (!next.delete(sectionId)) next.add(sectionId);
			return next;
		});
	/** Expands the section holding a choice before jumping to it. */
	const revealDecision = (decisionId: string, sectionId: string | undefined) => {
		if (sectionId && collapsed.has(sectionId)) toggleSection(sectionId);
		requestAnimationFrame(() =>
			document.getElementById(`decision-${decisionId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }),
		);
	};
	// Choices made outside this chapter render once, above the first expanded section they shape.
	const placedBars = new Map<string, string>();
	return (
		<ol className="flex flex-col gap-6">
			{sections.map(({ section, state, decisionIds, pendingOn, steps }) => {
				const isCollapsed = collapsed.has(section.id);
				const required = steps.filter((view) => !view.step.optional);
				const complete = required.length > 0 && required.every((view) => view.done);
				const bars: string[] = [];
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
					} else if (!placedBars.has(decisionId)) {
						if (isCollapsed) continue;
						placedBars.set(decisionId, section.id);
						bars.push(decisionId);
					} else if (pendingOn.includes(decisionId)) {
						links.push({ decisionId, label: "Choose above" });
					}
				}
				return (
					<li key={section.id}>
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
										revealDecision(decisionId, sectionId ?? placedBars.get(decisionId));
									}}
									title={STORY_DECISION_BY_ID[decisionId]?.prompt}
									className="inline-flex"
								>
									<Badge tone="info" size="xs" className="hover:border-info/50">
										<GitBranch aria-hidden="true" />
										{label}
									</Badge>
								</a>
							))}
						</div>
						{!isCollapsed &&
							bars.map((decisionId) => (
								<StoryDecisionControl
									key={decisionId}
									id={`decision-${decisionId}`}
									decision={STORY_DECISION_BY_ID[decisionId]}
									layout="bar"
									className="mb-2 rounded-md border border-info/25 bg-info/5 px-3 py-2.5"
									{...decisionProps}
								/>
							))}
						{!isCollapsed && (
							<ol
								className={cn(
									"flex flex-col rounded-md border border-highlight/10 bg-card",
									state === "pending" && "opacity-60",
								)}
							>
								{steps.map((view) => (
									<StepRow key={view.step.id} view={view} decisionProps={decisionProps} onToggleStep={onToggleStep} />
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
	onToggleStep,
	nested = false,
}: {
	view: StepView;
	decisionProps: DecisionProps;
	onToggleStep: (stepId: string, done: boolean) => void;
	nested?: boolean;
}) {
	const { step, done, state, lightkeeperBlocked, substeps } = view;
	const decision = step.decision ? STORY_DECISION_BY_ID[step.decision] : undefined;
	const optional = Boolean(step.optional);
	return (
		<li
			id={`step-${step.id}`}
			className={cn(
				"flex scroll-mt-24 gap-3 px-3 py-2.5",
				nested ? "py-1.5 pl-0" : "border-b border-highlight/8 last:border-b-0",
				state === "pending" && !nested && "opacity-70",
			)}
		>
			<button
				type="button"
				onClick={() => onToggleStep(step.id, !done)}
				aria-pressed={done}
				aria-label={`${done ? "Mark as not done" : "Mark as done"}: ${step.text}`}
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
						<Badge tone="info" size="xs">
							Optional
						</Badge>
					)}
					<span
						className={cn(
							nested ? "text-xs" : "text-sm",
							done ? "text-muted-foreground line-through" : optional ? "text-muted-foreground" : "text-foreground",
						)}
					>
						{step.text}
					</span>
					{step.map && (
						<Badge size="xs">
							<MapPin aria-hidden="true" />
							{step.map}
						</Badge>
					)}
					{step.requiresLightkeeper && (
						<Badge tone={lightkeeperBlocked ? "danger" : "neutral"} size="xs">
							{lightkeeperBlocked ? <TriangleAlert aria-hidden="true" /> : null}
							Lightkeeper
						</Badge>
					)}
				</div>
				{step.note && <p className="mt-0.5 text-xs text-muted-foreground">{step.note}</p>}
				{step.warning && (
					<p className="mt-0.5 flex items-start gap-1 text-xs text-danger">
						<TriangleAlert aria-hidden="true" className="mt-px size-3 shrink-0" />
						{step.warning}
					</p>
				)}
				{step.quests && step.quests.length > 0 && (
					<div className="mt-1 flex flex-wrap items-center gap-1.5">
						{step.quests.map((quest) => (
							<QuestLink
								key={quest.id}
								questId={quest.id}
								name={quest.name}
								className="inline-flex items-center gap-1 text-xs text-brand hover:underline"
							>
								<ScrollText aria-hidden="true" className="size-3" />
								{quest.name}
							</QuestLink>
						))}
					</div>
				)}
				{step.rewards && step.rewards.length > 0 && (
					<p className="mt-1 flex items-start gap-1 text-xs text-success">
						<Gift aria-hidden="true" className="mt-px size-3 shrink-0" />
						{step.rewards.join(" · ")}
					</p>
				)}
				{step.items && step.items.length > 0 && <StepItems items={step.items} nested={nested} />}
				{decision && (
					<StoryDecisionControl
						id={`decision-${decision.id}`}
						decision={decision}
						className="mt-2.5"
						{...decisionProps}
					/>
				)}
				{substeps.length > 0 && (
					<ol className="mt-1.5 flex flex-col">
						{substeps.map((substep) => (
							<StepRow
								key={substep.step.id}
								view={substep}
								decisionProps={decisionProps}
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
							<div className="flex flex-wrap items-center gap-1.5 text-xs text-foreground">
								{item.name}
								{source && <ChapterBadge {...source} />}
							</div>
							{item.note && <p className="text-[11px] text-muted-foreground">{item.note}</p>}
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
