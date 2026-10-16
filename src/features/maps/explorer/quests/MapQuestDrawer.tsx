"use client";

/* eslint-disable @next/next/no-img-element -- quest and trader art come from tarkov.dev at fixed sizes */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Circle, Crown, ExternalLink, KeyRound, MapPin, X } from "lucide-react";
import { compareQuestTradersByOrder } from "@/lib/cfg/questTraderOrder";
import { questHref } from "@/lib/entity-routes";
import { useUserStore } from "@/lib/stores/useUserStore";
import type { ItemSummary } from "@/types/items";
import type { FullQuest, FullQuestObjective, QuestObjectiveShootType, QuestSummary } from "@/types/quests";
import { QuestObjectiveIcon } from "../../../quests/objectives/QuestObjectiveIcon";
import {
	getAvailableObjectiveCategories,
	getObjectiveCategory,
	getQuestObjectiveCategories,
	OBJECTIVE_CATEGORY_SHORT_LABELS,
	type QuestObjectiveCategory,
} from "../../../quests/workspace/quest-workspace-utils";
import { QuestObjectiveTypeTag } from "../../../quests/workspace/QuestObjectiveTypeTag";
import { getRaidPlannerMapKey, isLocationOnRaidPlannerMap } from "../../../quests/workspace/raid-planner-maps";
import { CATEGORY_TYPES } from "./quest-map-markers";
import { QuestMarkerGlyph } from "./QuestMarkerGlyph";

export type QuestFocus = { questId: string; objectiveId?: string } | null;

/**
 * Right-edge drawer for the active quests on this map: a list grouped by trader (filterable by objective type,
 * with a kill summary for Kill), or one quest's details. Hovering a quest or objective reports it so the map can
 * dim the rest; `highlighted` (from hovering a map marker) marks a row and scrolls it into view.
 */
export function MapQuestDrawer({
	open,
	onOpen,
	mapKey,
	mapLabel,
	quests,
	detailsById,
	items,
	colors,
	selected,
	onSelect,
	highlighted,
	onHover,
	onShowObjective,
	pending,
	error,
	onRetry,
}: {
	open: boolean;
	onOpen: (open: boolean) => void;
	mapKey: string;
	mapLabel: string;
	quests: readonly QuestSummary[];
	detailsById: ReadonlyMap<string, FullQuest>;
	items: readonly ItemSummary[];
	/** Marker colour by quest id. */
	colors: ReadonlyMap<string, string>;
	selected: string | null;
	onSelect: (questId: string | null) => void;
	highlighted: string | null;
	onHover: (focus: QuestFocus) => void;
	/** Moves the map to an objective's marker. */
	onShowObjective: (questId: string, objectiveId: string) => void;
	pending: boolean;
	error: string | null;
	onRetry: () => void;
}) {
	// Kept here so the filter survives opening a quest and coming back.
	const [category, setCategory] = useState<QuestObjectiveCategory | null>(null);
	const selectedSummary = selected ? quests.find((quest) => quest.id === selected) : undefined;
	return (
		<>
			<button
				type="button"
				className={`quest-drawer-tab ${open ? "active" : ""}`}
				aria-expanded={open}
				aria-controls="map-quest-drawer"
				onClick={() => onOpen(!open)}
			>
				<span>Quests</span>
				{quests.length > 0 && <span className="quest-drawer-count">{quests.length}</span>}
			</button>
			{open && (
				<aside id="map-quest-drawer" className="quest-drawer" aria-label={`Active quests on ${mapLabel}`}>
					{selectedSummary ? (
						<QuestDetail
							summary={selectedSummary}
							quest={detailsById.get(selectedSummary.id)}
							color={colors.get(selectedSummary.id)}
							items={items}
							mapKey={mapKey}
							onBack={() => onSelect(null)}
							onClose={() => onOpen(false)}
							onHover={onHover}
							onShowObjective={onShowObjective}
						/>
					) : (
						<QuestList
							mapKey={mapKey}
							mapLabel={mapLabel}
							quests={quests}
							detailsById={detailsById}
							colors={colors}
							category={category}
							onCategory={setCategory}
							highlighted={highlighted}
							onSelect={onSelect}
							onHover={onHover}
							onClose={() => onOpen(false)}
							pending={pending}
							error={error}
							onRetry={onRetry}
						/>
					)}
				</aside>
			)}
		</>
	);
}

function QuestList({
	mapKey,
	mapLabel,
	quests,
	detailsById,
	colors,
	category,
	onCategory,
	highlighted,
	onSelect,
	onHover,
	onClose,
	pending,
	error,
	onRetry,
}: {
	mapKey: string;
	mapLabel: string;
	quests: readonly QuestSummary[];
	detailsById: ReadonlyMap<string, FullQuest>;
	colors: ReadonlyMap<string, string>;
	category: QuestObjectiveCategory | null;
	onCategory: (category: QuestObjectiveCategory | null) => void;
	highlighted: string | null;
	onSelect: (questId: string) => void;
	onHover: (focus: QuestFocus) => void;
	onClose: () => void;
	pending: boolean;
	error: string | null;
	onRetry: () => void;
}) {
	const categories = useMemo(() => getAvailableObjectiveCategories([...quests]), [quests]);
	const shownCategory = category && categories.includes(category) ? category : null;
	const shown = useMemo(
		() => (shownCategory ? quests.filter((quest) => getQuestObjectiveCategories(quest).has(shownCategory)) : quests),
		[quests, shownCategory],
	);
	const groups = useMemo(() => {
		const byTrader = new Map<string, QuestSummary[]>();
		for (const quest of shown) byTrader.set(quest.trader.id, [...(byTrader.get(quest.trader.id) ?? []), quest]);
		return [...byTrader.values()].sort((a, b) => compareQuestTradersByOrder(a[0].trader.name, b[0].trader.name));
	}, [shown]);

	const rows = useRef(new Map<string, HTMLElement>());
	useEffect(() => {
		if (highlighted) rows.current.get(highlighted)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
	}, [highlighted]);

	return (
		<>
			<header className="quest-drawer-head">
				<div>
					<h2>Active quests</h2>
					<p>
						{shown.length === quests.length ? quests.length : `${shown.length} of ${quests.length}`} on {mapLabel}
					</p>
				</div>
				<button type="button" className="icon-button" title="Close quests" onClick={onClose}>
					<X size={15} />
				</button>
			</header>
			{categories.length > 1 && (
				<div className="quest-filters" role="group" aria-label="Objective type">
					{categories.map((option) => (
						<button
							type="button"
							key={option}
							className={`quest-filter ${shownCategory === option ? "active" : ""}`}
							aria-pressed={shownCategory === option}
							onClick={() => onCategory(shownCategory === option ? null : option)}
						>
							<QuestObjectiveIcon type={CATEGORY_TYPES[option]} size={11} />
							{OBJECTIVE_CATEGORY_SHORT_LABELS[option]}
						</button>
					))}
				</div>
			)}
			<div className="quest-drawer-body" onMouseLeave={() => onHover(null)}>
				{error && (
					<div className="quest-drawer-note" role="alert">
						<span>{error}</span>
						<button type="button" onClick={onRetry}>
							Retry
						</button>
					</div>
				)}
				{pending && quests.length === 0 && (
					<p className="quest-drawer-note" role="status">
						Loading quests…
					</p>
				)}
				{!pending && !error && quests.length === 0 && (
					<p className="quest-drawer-note">No active quests on this map for your profile.</p>
				)}
				{shownCategory === "eliminate" && (
					<KillSummary
						mapKey={mapKey}
						quests={shown}
						detailsById={detailsById}
						colors={colors}
						onSelect={onSelect}
						onHover={onHover}
					/>
				)}
				{groups.map((group) => (
					<section key={group[0].trader.id} className="quest-trader">
						<h3 className="quest-trader-head">
							{group[0].trader.imageLink && <img src={group[0].trader.imageLink} alt="" />}
							<span>{group[0].trader.name}</span>
							<span className="quest-trader-count">{group.length}</span>
						</h3>
						{group.map((quest) => (
							<button
								type="button"
								key={quest.id}
								ref={(element) => {
									if (element) rows.current.set(quest.id, element);
									else rows.current.delete(quest.id);
								}}
								className={`quest-row ${highlighted === quest.id ? "highlighted" : ""}`}
								style={{ "--quest-color": colors.get(quest.id) } as CSSProperties}
								onMouseEnter={() => onHover({ questId: quest.id })}
								onFocus={() => onHover({ questId: quest.id })}
								onClick={() => onSelect(quest.id)}
							>
								<span className="quest-row-art">
									{quest.taskImageLink ? <img src={quest.taskImageLink} alt="" /> : <span>{quest.name[0]}</span>}
								</span>
								<span className="quest-row-text">
									<span className="quest-row-name">{quest.name}</span>
									<span className="quest-row-meta">
										{(quest.minPlayerLevel ?? 0) > 0 && <span>Lv {quest.minPlayerLevel}</span>}
										{[...getQuestObjectiveCategories(quest)].slice(0, 3).map((option) => (
											<QuestObjectiveTypeTag key={option} category={option} />
										))}
										{quest.hasRequiredKeys && (
											<span title="Needs a key">
												<KeyRound size={10} />
											</span>
										)}
										{quest.kappaRequired && (
											<span className="quest-kappa" title="Required for Kappa">
												<Crown size={10} />
											</span>
										)}
									</span>
								</span>
							</button>
						))}
					</section>
				))}
			</div>
		</>
	);
}

/** Whether an objective counts here: no map restriction, or this map among its maps. */
function objectiveOnMap(objective: FullQuestObjective, mapKey: string) {
	const key = getRaidPlannerMapKey(mapKey);
	return (
		!objective.maps?.length ||
		objective.maps.some((map) => [map.normalizedName, map.name].some((value) => getRaidPlannerMapKey(value) === key))
	);
}

function targetOf(objective: QuestObjectiveShootType) {
	return objective.targetNames?.length ? objective.targetNames.join(" / ") : objective.target || "Any target";
}

/** Every kill objective of the listed quests that counts on this map, with kills needed per target. */
function KillSummary({
	mapKey,
	quests,
	detailsById,
	colors,
	onSelect,
	onHover,
}: {
	mapKey: string;
	quests: readonly QuestSummary[];
	detailsById: ReadonlyMap<string, FullQuest>;
	colors: ReadonlyMap<string, string>;
	onSelect: (questId: string) => void;
	onHover: (focus: QuestFocus) => void;
}) {
	const visited = useUserStore((state) => state.completedQuestObjectives);
	const kills = quests.flatMap((summary) => {
		const quest = detailsById.get(summary.id);
		return (quest?.objectives ?? [])
			.filter(
				(objective): objective is QuestObjectiveShootType =>
					objective.type === "shoot" && !visited[summary.id]?.[objective.id] && objectiveOnMap(objective, mapKey),
			)
			.map((objective) => ({ quest: summary, objective }));
	});
	const totals = new Map<string, number>();
	for (const { objective } of kills)
		totals.set(targetOf(objective), (totals.get(targetOf(objective)) ?? 0) + objective.count);
	if (!kills.length) return null;
	return (
		<section className="kill-summary" aria-label="Kill objectives">
			<h3 className="quest-detail-section">Kills needed</h3>
			<div className="kill-totals">
				{[...totals].map(([target, count]) => (
					<span key={target}>
						<strong>{count}</strong> {target}
					</span>
				))}
			</div>
			<ul className="kill-list">
				{kills.map(({ quest, objective }) => (
					<li key={objective.id}>
						<button
							type="button"
							onMouseEnter={() => onHover({ questId: quest.id, objectiveId: objective.id })}
							onClick={() => onSelect(quest.id)}
						>
							<QuestMarkerGlyph type="shoot" color={colors.get(quest.id) ?? "var(--me-faint)"} />
							<span className="kill-text">
								<span>
									<strong>{objective.count}×</strong> {targetOf(objective)}
									{objective.maps?.length ? "" : " · any map"}
								</span>
								<span className="kill-quest">{quest.name}</span>
								<span className="kill-description">{objective.description}</span>
							</span>
						</button>
					</li>
				))}
			</ul>
		</section>
	);
}

function QuestDetail({
	summary,
	quest,
	color,
	items,
	mapKey,
	onBack,
	onClose,
	onHover,
	onShowObjective,
}: {
	summary: QuestSummary;
	quest: FullQuest | undefined;
	color: string | undefined;
	items: readonly ItemSummary[];
	mapKey: string;
	onBack: () => void;
	onClose: () => void;
	onHover: (focus: QuestFocus) => void;
	onShowObjective: (questId: string, objectiveId: string) => void;
}) {
	const visited = useUserStore((state) => state.completedQuestObjectives[summary.id]);
	const toggleVisited = useUserStore((state) => state.toggleQuestObjectiveCompletion);
	const itemNames = useMemo(() => new Map(items.map((item) => [item.id, item.shortName || item.name])), [items]);
	const prerequisites = summary.taskRequirements.map((requirement) => requirement.task.name);

	return (
		<>
			<header className="quest-drawer-head">
				<button type="button" className="quest-back" onClick={onBack}>
					<ArrowLeft size={14} /> Quests
				</button>
				<button type="button" className="icon-button" title="Close quests" onClick={onClose}>
					<X size={15} />
				</button>
			</header>
			<div className="quest-drawer-body quest-detail" onMouseLeave={() => onHover({ questId: summary.id })}>
				{summary.taskImageLink && <img className="quest-detail-art" src={summary.taskImageLink} alt="" />}
				<h2 className="quest-detail-name">{summary.name}</h2>
				<p className="quest-detail-meta">
					{summary.trader.imageLink && <img src={summary.trader.imageLink} alt="" />}
					<span>{summary.trader.name}</span>
					{(summary.minPlayerLevel ?? 0) > 0 && <span>· Lv {summary.minPlayerLevel}</span>}
					{summary.experience > 0 && <span>· {summary.experience.toLocaleString("en-US")} XP</span>}
					{summary.kappaRequired && <span className="quest-kappa">· Kappa</span>}
					{summary.lightkeeperRequired && <span>· Lightkeeper</span>}
				</p>
				<Link className="quest-detail-link" href={questHref(summary.id)} prefetch={false}>
					Open quest page <ExternalLink size={12} />
				</Link>

				<h3 className="quest-detail-section">Objectives</h3>
				{!quest ? (
					<p className="quest-drawer-note" role="status">
						Loading objectives…
					</p>
				) : (
					<ol className="quest-objectives">
						{quest.objectives.map((objective) => {
							const here = (objective.locations ?? []).some(
								(location) =>
									isLocationOnRaidPlannerMap(location, mapKey) && (location.position || location.outline.length),
							);
							const done = !!visited?.[objective.id];
							const keys = (objective.requiredKeyIds ?? []).map((group) =>
								group.map((id) => itemNames.get(id) ?? id).join(" or "),
							);
							const text = (
								<>
									<span>
										{objective.description}
										{objective.optional && <em> (optional)</em>}
									</span>
									{keys.length > 0 && (
										<span className="quest-objective-keys">
											<KeyRound size={10} /> {keys.join(", ")}
										</span>
									)}
								</>
							);
							return (
								<li
									key={objective.id}
									className={`quest-objective ${done ? "done" : ""} ${here && !done ? "placed" : ""}`}
									onMouseEnter={() => onHover({ questId: summary.id, objectiveId: objective.id })}
								>
									{here && !done ? (
										<button
											type="button"
											className="quest-objective-main"
											title={`Show on the map · ${OBJECTIVE_CATEGORY_SHORT_LABELS[getObjectiveCategory(objective.type)]}`}
											onClick={() => onShowObjective(summary.id, objective.id)}
										>
											<QuestMarkerGlyph type={objective.type} color={color ?? "var(--me-faint)"} />
											<span className="quest-objective-text">{text}</span>
										</button>
									) : (
										<div className="quest-objective-main">
											<QuestObjectiveIcon type={objective.type} size={13} className="quest-objective-icon" />
											<span className="quest-objective-text">{text}</span>
										</div>
									)}
									{here ? (
										<button
											type="button"
											className="quest-objective-visit"
											aria-pressed={done}
											title={done ? "Show on the map again" : "Mark done and hide its markers"}
											onClick={() => toggleVisited(summary.id, objective.id)}
										>
											{done ? <CheckCircle2 size={14} /> : <Circle size={14} />}
										</button>
									) : (
										<MapPin size={12} className="quest-objective-elsewhere" aria-label="No marked location" />
									)}
								</li>
							);
						})}
					</ol>
				)}

				{prerequisites.length > 0 && (
					<>
						<h3 className="quest-detail-section">Requires</h3>
						<ul className="quest-prerequisites">
							{prerequisites.map((name) => (
								<li key={name}>{name}</li>
							))}
						</ul>
					</>
				)}
			</div>
		</>
	);
}
