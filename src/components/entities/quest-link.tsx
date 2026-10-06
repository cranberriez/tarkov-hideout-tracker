"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { preloadHoverImage, useHoverDataIntent } from "@/components/ui/hover-preview-provider";
import { questHref } from "@/lib/entity-routes";
import { toTarkovJsonGameMode } from "@/lib/game-mode";
import { getQuestIssuingTraderLoyaltyLevel } from "@/lib/quests/quest-trader-gates";
import { questWorkspacePageQueryOptions } from "@/lib/query/page-data";
import { decodeSearchManifest } from "@/lib/search/manifest";
import { searchIdentityOptions, searchManifestOptions } from "@/lib/search/query";
import { useUserStore } from "@/lib/stores/useUserStore";
import type { QuestWorkspaceQuest, FullQuestObjective } from "@/types/quests";
import { useQuestDetails } from "@/features/quests/useQuestDetails";
import { EntityPreview, PreviewFact } from "./entity-preview";

type LinkProps = Omit<ComponentProps<typeof Link>, "href" | "children">;

/**
 * Link to `/quests/[questId]` with a hover/focus preview. Uses the supplied quest,
 * else the already-cached workspace payload; otherwise the card shows the name only.
 */
export function QuestLink({
	questId,
	quest,
	name,
	children,
	preview = true,
	className,
	...props
}: LinkProps & {
	questId: string;
	quest?: QuestWorkspaceQuest | null;
	/** Fallback label when the quest record is not supplied. */
	name?: string;
	children?: ReactNode;
	preview?: boolean;
}) {
	const client = useQueryClient();
	const mode = toTarkovJsonGameMode(useUserStore((state) => state.gameMode));
	const prepare = async () => {
		const workspace = client.getQueryData(questWorkspacePageQueryOptions(mode).queryKey);
		const cachedQuest = quest ?? workspace?.quests?.find((entry) => entry.id === questId);
		const suppliedImage = cachedQuest?.trader.image4xLink ?? cachedQuest?.trader.imageLink;
		if (suppliedImage) return preloadHoverImage(suppliedImage);
		const identity = await client.ensureQueryData(searchIdentityOptions(mode));
		const manifest = await client.ensureQueryData(searchManifestOptions(mode, identity.releaseId));
		const traderId = cachedQuest?.trader.id ?? manifest.quests.find((entry) => entry.id === questId)?.traderId;
		return preloadHoverImage(traderId ? manifest.traders[traderId]?.iconLink : null);
	};
	return (
		<EntityPreview
			disabled={!preview}
			prepare={prepare}
			renderPreview={() => <QuestPreviewCard questId={questId} quest={quest} name={name} />}
		>
			{(triggerProps) => (
				<Link {...props} {...triggerProps} prefetch={false} href={questHref(questId)} className={className}>
					{children ?? quest?.name ?? name ?? "Quest"}
				</Link>
			)}
		</EntityPreview>
	);
}

function useCachedQuest(questId: string, quest: QuestWorkspaceQuest | null | undefined) {
	const client = useQueryClient();
	const mode = toTarkovJsonGameMode(useUserStore((state) => state.gameMode));
	if (quest) return quest;
	const data = client.getQueryData(questWorkspacePageQueryOptions(mode).queryKey);
	return data?.quests?.find((entry) => entry.id === questId) ?? null;
}

function objectiveItemLines(objectives: FullQuestObjective[], itemNames: ReadonlyMap<string, string>) {
	const lines: string[] = [];
	for (const objective of objectives) {
		if (
			(objective.type === "giveItem" || objective.type === "plantItem" || objective.type === "findItem") &&
			"itemIds" in objective
		) {
			const names = [
				...objective.itemIds.map((id) => itemNames.get(id)).filter((name): name is string => !!name),
				...(objective.questSpecificItems ?? []).map((item) => item.name),
			];
			const action = objective.type === "giveItem" ? "Hand over" : objective.type === "plantItem" ? "Plant" : "Find";
			if (!objective.isPartial && names.length > 0) {
				const itemText = `${names.slice(0, 2).join(" or ")}${names.length > 2 ? ` or +${names.length - 2} more` : ""}`;
				lines.push(`${action}: ${objective.count} × ${itemText}${objective.foundInRaid ? " (FiR)" : ""}`);
			} else if (objective.description) {
				lines.push(objective.description);
			}
		}
		for (const group of objective.requiredKeyIds ?? []) {
			const names = group.map((id) => itemNames.get(id)).filter((name): name is string => !!name);
			if (names.length > 0) lines.push(`Required key: ${names.join(" or ")}`);
		}
	}
	return lines;
}

function QuestPreviewCard({
	questId,
	quest: suppliedQuest,
	name,
}: {
	questId: string;
	quest?: QuestWorkspaceQuest | null;
	name?: string;
}) {
	const cachedQuest = useCachedQuest(questId, suppliedQuest);
	const intent = useHoverDataIntent();
	const details = useQuestDetails([questId], intent);
	const quest = details.quests[0] ?? cachedQuest;
	const client = useQueryClient();
	const mode = toTarkovJsonGameMode(useUserStore((state) => state.gameMode));
	const releaseId = client.getQueryData<{ releaseId: string }>(searchIdentityOptions(mode).queryKey)?.releaseId;
	const manifest = releaseId
		? client.getQueryData<ReturnType<typeof decodeSearchManifest>>(searchManifestOptions(mode, releaseId).queryKey)
		: undefined;
	const traderId = quest?.trader.id ?? manifest?.quests.find((entry) => entry.id === questId)?.traderId;
	const trader = traderId ? manifest?.traders[traderId] : undefined;
	const itemNames = new Map(details.items.map((item) => [item.id, item.name]));
	const completed = useUserStore((state) => !!state.completedQuests[questId]);
	const failed = useUserStore((state) => !!state.failedQuests[questId]);
	const completedQuests = useUserStore((state) => state.completedQuests);
	const traderImage = quest?.trader.image4xLink ?? quest?.trader.imageLink ?? trader?.iconLink;
	const traderName = quest?.trader.name ?? trader?.name;
	const fullQuest = quest && "objectives" in quest ? quest : null;
	const itemLines = fullQuest ? objectiveItemLines(fullQuest.objectives, itemNames) : [];
	const objectives =
		fullQuest?.objectives.filter(
			(objective) =>
				objective.description &&
				objective.type !== "giveItem" &&
				objective.type !== "plantItem" &&
				objective.type !== "findItem",
		) ?? [];
	const prerequisites = quest?.taskRequirements ?? [];

	return (
		<div>
			{intent && details.pending && (
				<p role="status" className="text-xs text-muted-foreground">
					Loading objectives…
				</p>
			)}
			{details.error && (
				<p role="alert" className="text-xs text-danger">
					{details.error}{" "}
					<button onClick={details.retry} className="underline">
						Retry
					</button>
				</p>
			)}
			{details.missingQuestIds.length > 0 && (
				<p className="text-xs text-muted-foreground">Quest details are unavailable in this mode.</p>
			)}
			{details.unresolvedItemIds.length > 0 && (
				<p className="text-xs text-muted-foreground">Some referenced items are unavailable.</p>
			)}
			<div className="flex items-center gap-2.5">
				{traderImage && (
					// eslint-disable-next-line @next/next/no-img-element -- trader portraits come from the data provider
					<img
						src={traderImage}
						alt=""
						className="size-8 shrink-0 rounded-full border border-highlight/10 object-cover"
					/>
				)}
				<div className="min-w-0">
					{traderName && (
						<p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-subtle-foreground">{traderName}</p>
					)}
					<p className="text-xs font-semibold leading-snug text-foreground">{quest?.name ?? name ?? "Quest"}</p>
				</div>
			</div>
			<div className="mt-2 flex flex-wrap gap-1">
				{completed ? (
					<Badge tone="success" size="xs">
						Completed
					</Badge>
				) : failed ? (
					<Badge tone="danger" size="xs">
						Failed
					</Badge>
				) : (
					<Badge size="xs">Not completed</Badge>
				)}
				{quest?.kappaRequired && (
					<Badge tone="warning" size="xs">
						Kappa
					</Badge>
				)}
				{quest?.lightkeeperRequired && (
					<Badge tone="info" size="xs">
						Lightkeeper
					</Badge>
				)}
			</div>
			{quest && (
				<div className="mt-2 space-y-1">
					{(quest.minPlayerLevel ?? 0) > 0 && <PreviewFact label="Level">{quest.minPlayerLevel}</PreviewFact>}
					<PreviewFact label="Trader loyalty">LL{getQuestIssuingTraderLoyaltyLevel(quest)}</PreviewFact>
					{quest.map && (
						<PreviewFact label="Map">
							<span className="inline-flex items-center gap-1">
								<MapPin size={11} aria-hidden="true" />
								{quest.map.name}
							</span>
						</PreviewFact>
					)}
					{prerequisites.length > 0 && (
						<PreviewFact label="Requires">
							{prerequisites.slice(0, 2).map((requirement) => (
								<span
									key={requirement.task.id}
									className={completedQuests[requirement.task.id] ? "block text-success" : "block"}
								>
									{requirement.task.name}
								</span>
							))}
							{prerequisites.length > 2 && (
								<span className="block text-subtle-foreground">+{prerequisites.length - 2} more</span>
							)}
						</PreviewFact>
					)}
				</div>
			)}
			{itemLines.length > 0 && (
				<div className="mt-2 text-[11px] text-muted-foreground">
					<p className="mb-1 font-semibold text-subtle-foreground">Required items</p>
					<ul className="space-y-1">
						{itemLines.slice(0, 3).map((line, index) => (
							<li key={`${index}-${line}`} className="line-clamp-2">
								{line}
							</li>
						))}
						{itemLines.length > 3 && <li className="text-subtle-foreground">+{itemLines.length - 3} more</li>}
					</ul>
				</div>
			)}
			{objectives.length > 0 && (
				<ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
					{objectives.slice(0, 3).map((objective) => (
						<li key={objective.id} className="line-clamp-2">
							{objective.description}
						</li>
					))}
					{objectives.length > 3 && (
						<li className="text-subtle-foreground">+{objectives.length - 3} more objectives</li>
					)}
				</ul>
			)}
		</div>
	);
}
