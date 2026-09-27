"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { questHref } from "@/lib/entity-routes";
import { toTarkovJsonGameMode } from "@/lib/game-mode";
import { questWorkspacePageQueryOptions } from "@/lib/query/page-data";
import { useUserStore } from "@/lib/stores/useUserStore";
import type { QuestWorkspacePageData } from "@/types/contracts";
import type { FullQuest } from "@/types/quests";
import { EntityPreview, PreviewFact, PreviewFooter } from "./entity-preview";

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
	quest?: FullQuest | null;
	/** Fallback label when the quest record is not supplied. */
	name?: string;
	children?: ReactNode;
	preview?: boolean;
}) {
	return (
		<EntityPreview
			disabled={!preview}
			renderPreview={() => <QuestPreviewCard questId={questId} quest={quest} name={name} />}
		>
			{(triggerProps) => (
				<Link {...props} {...triggerProps} href={questHref(questId)} className={className}>
					{children ?? quest?.name ?? name ?? "Quest"}
				</Link>
			)}
		</EntityPreview>
	);
}

function useCachedQuest(questId: string, quest: FullQuest | null | undefined) {
	const client = useQueryClient();
	const mode = toTarkovJsonGameMode(useUserStore((state) => state.gameMode));
	if (quest) return quest;
	const data = client.getQueryData<QuestWorkspacePageData>(questWorkspacePageQueryOptions(mode).queryKey);
	return data?.quests?.find((entry) => entry.id === questId) ?? null;
}

function QuestPreviewCard({
	questId,
	quest: suppliedQuest,
	name,
}: {
	questId: string;
	quest?: FullQuest | null;
	name?: string;
}) {
	const quest = useCachedQuest(questId, suppliedQuest);
	const completed = useUserStore((state) => !!state.completedQuests[questId]);
	const failed = useUserStore((state) => !!state.failedQuests[questId]);
	const completedQuests = useUserStore((state) => state.completedQuests);
	const traderImage = quest?.trader.image4xLink ?? quest?.trader.imageLink;
	const objectives = quest?.objectives.filter((objective) => objective.description) ?? [];
	const prerequisites = quest?.taskRequirements ?? [];

	return (
		<div>
			<div className="flex items-center gap-2.5">
				{traderImage && (
					// eslint-disable-next-line @next/next/no-img-element -- trader portraits come from the data provider
					<img
						src={traderImage}
						alt=""
						className="size-9 shrink-0 rounded-full border border-highlight/10 object-cover"
					/>
				)}
				<div className="min-w-0">
					{quest && (
						<p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-subtle-foreground">
							{quest.trader.name}
						</p>
					)}
					<p className="text-sm font-semibold leading-snug text-foreground">{quest?.name ?? name ?? "Quest"}</p>
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
				<div className="mt-3 space-y-1.5">
					{(quest.minPlayerLevel ?? 0) > 0 && <PreviewFact label="Level">{quest.minPlayerLevel}</PreviewFact>}
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
			{objectives.length > 0 && (
				<ul className="mt-3 space-y-1 border-t border-highlight/8 pt-2 text-xs text-muted-foreground">
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
			<PreviewFooter>Open quest details</PreviewFooter>
		</div>
	);
}
