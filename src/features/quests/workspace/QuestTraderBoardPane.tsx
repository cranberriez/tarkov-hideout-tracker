"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useUserStore } from "@/lib/stores/useUserStore";
import { cn } from "@/lib/utils";
import {
	buildQuestTraderBoard,
	type TraderBoardColumn,
	type TraderBoardGroup,
	type TraderBoardSection,
} from "./quest-trader-board-model";
import { useQuestWorkspace } from "./QuestWorkspaceContext";
import { QuestMobileMenuSpacer } from "./QuestMobileMenu";

const LEGEND = [
	{ label: "Available", className: "bg-info" },
	{ label: "Upcoming", className: "bg-warning" },
	{ label: "Locked", className: "bg-subtle-foreground/40" },
	{ label: "Completed", className: "bg-success" },
	{ label: "Failed", className: "bg-danger" },
];

export function QuestTraderBoardPane() {
	const { quests, questDataIndex, statusByQuestId, upcomingLockedQuestIds, pinnedQuests, showPinnedOnly } =
		useQuestWorkspace();
	const hiddenQuests = useUserStore((state) => state.ignoredQuests);
	const [expandedSectionIds, setExpandedSectionIds] = useState<Set<string>>(() => new Set());
	const [activeColumnIndex, setActiveColumnIndex] = useState(0);
	const scrollerRef = useRef<HTMLDivElement>(null);
	const traderStripRef = useRef<HTMLDivElement>(null);
	const columns = useMemo(
		() =>
			buildQuestTraderBoard({
				quests,
				statusByQuestId,
				upcomingLockedQuestIds,
				hiddenQuests,
				pinnedQuests,
				showPinnedOnly,
				questOrderById: questDataIndex.questOrderById,
			}),
		[
			hiddenQuests,
			pinnedQuests,
			showPinnedOnly,
			questDataIndex.questOrderById,
			quests,
			statusByQuestId,
			upcomingLockedQuestIds,
		],
	);
	const toggleSection = (sectionId: string) =>
		setExpandedSectionIds((current) => {
			const next = new Set(current);
			if (next.has(sectionId)) next.delete(sectionId);
			else next.add(sectionId);
			return next;
		});
	// Below `sm` each column is exactly one scroller width wide and snaps, so position maps to an index.
	const syncActiveColumn = () => {
		const scroller = scrollerRef.current;
		if (scroller) setActiveColumnIndex(Math.round(scroller.scrollLeft / scroller.clientWidth));
	};
	const showColumn = (index: number) => {
		const scroller = scrollerRef.current;
		scroller?.scrollTo({ left: index * scroller.clientWidth, behavior: "smooth" });
	};
	useEffect(() => {
		const strip = traderStripRef.current;
		const button = strip?.children[activeColumnIndex] as HTMLElement | undefined;
		if (!strip || !button) return;
		if (button.offsetLeft < strip.scrollLeft) strip.scrollTo({ left: button.offsetLeft, behavior: "smooth" });
		else if (button.offsetLeft + button.offsetWidth > strip.scrollLeft + strip.clientWidth)
			strip.scrollTo({ left: button.offsetLeft + button.offsetWidth - strip.clientWidth, behavior: "smooth" });
	}, [activeColumnIndex]);

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-[var(--background)]">
			<div className="hidden shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-highlight/10 px-4 py-2 text-[10px] text-subtle-foreground sm:flex">
				<h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground">Trader board</h2>
				{LEGEND.map((entry) => (
					<span key={entry.label} className="flex items-center gap-1.5">
						<i className={cn("h-1.5 w-1.5 rounded-full", entry.className)} /> {entry.label}
					</span>
				))}
			</div>
			{columns.length === 0 && (
				<p className="px-5 py-14 text-center text-sm text-subtle-foreground">
					{showPinnedOnly ? "No pinned quests to show." : "No quests to show."}
				</p>
			)}
			<div
				ref={traderStripRef}
				aria-label="Traders"
				className="flex shrink-0 gap-1 overflow-x-auto border-b border-highlight/10 px-2 py-2 [scrollbar-width:none] sm:hidden"
			>
				{columns.map((column, index) => (
					<button
						key={column.trader.id}
						type="button"
						aria-label={`${column.trader.name}, ${column.doneCount} of ${column.totalCount} done`}
						aria-current={index === activeColumnIndex}
						onClick={() => showColumn(index)}
						className={cn(
							"flex shrink-0 flex-col items-center gap-1 rounded-sm px-1.5 py-1 transition-colors",
							index === activeColumnIndex ? "bg-highlight/10" : "opacity-60",
						)}
					>
						<TraderAvatar trader={column.trader} className="h-8 w-8" />
						<ProgressBar column={column} className="w-8" />
					</button>
				))}
			</div>
			<div
				ref={scrollerRef}
				onScroll={syncActiveColumn}
				className="min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden sm:snap-none sm:overflow-y-auto sm:p-3"
			>
				<div className="flex h-full items-stretch sm:h-auto sm:w-max sm:items-start sm:gap-2">
					{columns.map((column) => (
						<TraderColumn
							key={column.trader.id}
							column={column}
							expandedSectionIds={expandedSectionIds}
							onToggleSection={toggleSection}
						/>
					))}
				</div>
			</div>
		</div>
	);
}

function TraderAvatar({ trader, className }: { trader: TraderBoardColumn["trader"]; className?: string }) {
	const traderImage = trader.image4xLink ?? trader.imageLink;
	return traderImage ? (
		<img src={traderImage} alt="" className={cn("shrink-0 rounded-full object-cover", className)} />
	) : (
		<span className={cn("shrink-0 rounded-full bg-highlight/10", className)} />
	);
}

function ProgressBar({ column, className }: { column: TraderBoardColumn; className?: string }) {
	return (
		<div className={cn("h-0.5 bg-highlight/10", className)}>
			<div
				className="h-full bg-success"
				style={{ width: `${Math.round((column.doneCount / column.totalCount) * 100)}%` }}
			/>
		</div>
	);
}

function TraderColumn({
	column,
	expandedSectionIds,
	onToggleSection,
}: {
	column: TraderBoardColumn;
	expandedSectionIds: ReadonlySet<string>;
	onToggleSection: (sectionId: string) => void;
}) {
	const { trader, doneCount, totalCount } = column;
	return (
		<section
			aria-label={`${trader.name} quests`}
			className="w-full shrink-0 snap-start overflow-y-auto bg-[var(--card-bg)] p-3 sm:w-[220px] sm:overflow-visible sm:border sm:border-highlight/10 sm:p-2"
		>
			<header className="flex items-center gap-2 px-1">
				<TraderAvatar trader={trader} className="h-6 w-6" />
				<h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{trader.name}</h3>
				<span className="text-[10px] tabular-nums text-subtle-foreground">
					{doneCount}/{totalCount}
				</span>
			</header>
			<ProgressBar column={column} className="mx-1 mb-1 mt-1.5" />
			{column.sections.map((section) => (
				<BoardSection
					key={section.id}
					section={section}
					expanded={expandedSectionIds.has(section.id)}
					onToggle={() => onToggleSection(section.id)}
				/>
			))}
			<QuestMobileMenuSpacer />
		</section>
	);
}

function BoardSection({
	section,
	expanded,
	onToggle,
}: {
	section: TraderBoardSection;
	expanded: boolean;
	onToggle: () => void;
}) {
	const doneQuestIds = useMemo(() => new Set(section.doneQuestIds), [section.doneQuestIds]);
	return (
		<div className="mt-2">
			<div className="flex justify-between px-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-subtle-foreground">
				<span>{section.key === "essential" ? "Essential" : `Loyalty level ${section.key}`}</span>
				<span className="tabular-nums">
					{doneQuestIds.size}/{section.totalCount}
				</span>
			</div>
			{doneQuestIds.size > 0 && (
				<button
					type="button"
					aria-expanded={expanded}
					onClick={onToggle}
					className="flex w-full items-center gap-1.5 rounded-sm px-1 text-left text-[11px] leading-6 text-success/80 transition-colors hover:bg-highlight/6"
				>
					<Check size={12} /> {doneQuestIds.size} done
					<span className="ml-auto text-[10px] text-subtle-foreground">{expanded ? "Hide" : "Show"}</span>
				</button>
			)}
			{section.groups.map((group) => (
				<BoardGroup key={group.id} group={group} doneQuestIds={doneQuestIds} showDone={expanded} />
			))}
		</div>
	);
}

function BoardGroup({
	group,
	doneQuestIds,
	showDone,
}: {
	group: TraderBoardGroup;
	doneQuestIds: ReadonlySet<string>;
	showDone: boolean;
}) {
	const visibleQuestIds = showDone ? group.questIds : group.questIds.filter((questId) => !doneQuestIds.has(questId));
	if (visibleQuestIds.length === 0) return null;
	const quests = visibleQuestIds.map((questId) => <BoardQuest key={questId} questId={questId} />);
	if (!group.title) return quests;

	const groupDoneCount = group.questIds.filter((questId) => doneQuestIds.has(questId)).length;
	return (
		<div className="mt-1">
			<div className="flex justify-between gap-2 px-1 text-[10px] font-medium leading-5 text-subtle-foreground">
				<span className="truncate">{group.title}</span>
				<span className="tabular-nums">
					{groupDoneCount}/{group.questIds.length}
				</span>
			</div>
			<div className="ml-1.5 border-l border-highlight/10 pl-1">{quests}</div>
		</div>
	);
}

function BoardQuest({ questId }: { questId: string }) {
	const { questsById, statusByQuestId, upcomingLockedQuestIds, questHref, setMode } = useQuestWorkspace();
	const quest = questsById.get(questId)!;
	const status = statusByQuestId.get(questId)?.status;
	const upcoming = upcomingLockedQuestIds.has(questId);
	const dotClassName =
		status === "active"
			? "bg-info"
			: status === "completed"
				? "bg-success"
				: status === "failed"
					? "bg-danger"
					: upcoming
						? "bg-warning"
						: "bg-subtle-foreground/40";
	return (
		<Link
			href={questHref(questId)}
			scroll={false}
			// Same-route clicks never trigger the workspace's route effect, so switch to details directly.
			onClick={() => setMode("details")}
			title={quest.name}
			className={cn(
				"flex items-center gap-2 rounded-sm px-1 text-xs leading-6 transition-colors hover:bg-highlight/6 focus-visible:bg-highlight/6 focus-visible:outline-none",
				status === "active" || upcoming ? "text-foreground" : "text-subtle-foreground",
			)}
		>
			<i className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotClassName)} />
			<span className="min-w-0 truncate">{quest.name}</span>
		</Link>
	);
}
