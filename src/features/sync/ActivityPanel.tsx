"use client";

import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { ChevronRight, MapPin } from "lucide-react";
import { QuestLink } from "@/components/entities/quest-link";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { useUserStoreHydrated } from "@/lib/query/game-data";
import { questWorkspacePageQueryOptions } from "@/lib/query/page-data";
import { expandQuestSummaries } from "@/lib/quests/quest-summary-payload";
import { useCompanionSyncStore } from "@/lib/stores/useCompanionSyncStore";
import { useUserStore } from "@/lib/stores/useUserStore";
import { cn } from "@/lib/utils";
import type { QuestSummary } from "@/types/quests";
import { applyReview, dismissReview, undoBatch } from "./companion-actions";
import {
	activeProfileKey,
	dataModeForProfile,
	describeProfile,
	mapDisplayName,
	type FeedEntry,
	type FeedStatus,
	type PendingQuestEvent,
	type ProfileKey,
} from "./sync-model";
import { RawProtocolView } from "./RawProtocolView";
import { dayLabel, formatClock, useNow } from "./sync-view-utils";
import { useSyncHydrated } from "./useSyncHydrated";

const LINK_BUTTON =
	"text-xs font-medium text-brand hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline";

type QuestFinder = (profile: ProfileKey | null, questId: string) => QuestSummary | undefined;

/** Quest summaries for the data modes present in the feed. */
function useQuestFinder(profiles: readonly (ProfileKey | null)[]): QuestFinder {
	const userHydrated = useUserStoreHydrated();
	const modeKey = useMemo(
		() => [...new Set(profiles.flatMap((profile) => (profile ? [dataModeForProfile(profile)] : [])))].sort().join(","),
		[profiles],
	);
	const modes = useMemo(() => (modeKey ? modeKey.split(",") : []) as ReturnType<typeof dataModeForProfile>[], [modeKey]);
	const results = useQueries({
		queries: modes.map((mode) => ({ ...questWorkspacePageQueryOptions(mode), enabled: userHydrated })),
	});
	const stamp = results.map((result) => result.dataUpdatedAt).join();
	return useMemo(() => {
		const byMode = new Map(
			modes.map((mode, index) => [mode, new Map(expandQuestSummaries(results[index]?.data?.quests ?? []).map((quest) => [quest.id, quest]))]),
		);
		return (profile, questId) => {
			if (profile) return byMode.get(dataModeForProfile(profile))?.get(questId);
			for (const quests of byMode.values()) {
				const found = quests.get(questId);
				if (found) return found;
			}
			return undefined;
		};
		// `stamp` covers the query results.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [modes, stamp]);
}

const STATUS_TEXT: Partial<Record<FeedStatus, string>> = {
	review: "Needs review",
	undone: "Undone",
	unchanged: "Already done",
	unknown_mode: "Unknown mode",
	dismissed: "Dismissed",
};

const ACTION_TAG: Record<string, { label: string; tone: BadgeTone }> = {
	completed: { label: "Completed", tone: "success" },
	failed: { label: "Failed", tone: "danger" },
	accepted: { label: "Accepted", tone: "neutral" },
};

const PHASE_LABEL = { loading: "Loading raid", in_raid: "Raid started", ended: "Raid ended" } as const;

function ProfileChip({ profile }: { profile: ProfileKey | null }) {
	if (!profile) return null;
	return (
		<Badge variant="flat" size="xs" tone="neutral">
			{describeProfile(profile)}
		</Badge>
	);
}

function EntryRow({
	entry,
	quest,
	undoBatchId,
}: {
	entry: FeedEntry;
	quest: QuestSummary | undefined;
	undoBatchId: string | null;
}) {
	const statusText =
		entry.status === "waiting"
			? `Waiting for ${entry.profile ? describeProfile(entry.profile) : "profile"}`
			: STATUS_TEXT[entry.status];
	const warn = entry.status === "waiting" || entry.status === "review";

	const right = (
		<div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-x-2 gap-y-1 text-xs">
			{entry.kind === "quest" && entry.action && (
				<Badge variant="flat" size="xs" tone={ACTION_TAG[entry.action].tone}>
					{ACTION_TAG[entry.action].label}
				</Badge>
			)}
			<ProfileChip profile={entry.profile} />
			{entry.recovered && <span className="italic text-subtle-foreground">from history</span>}
			{statusText && <span className={warn ? "text-warning" : "text-subtle-foreground"}>{statusText}</span>}
			<span className="min-w-10 shrink-0 whitespace-nowrap text-right tabular-nums text-subtle-foreground">{formatClock(entry.at)}</span>
			{undoBatchId && (
				<button type="button" onClick={() => undoBatch(undoBatchId)} className={LINK_BUTTON}>
					Undo
				</button>
			)}
		</div>
	);

	if (entry.kind === "raid") {
		const mapName = entry.map ? mapDisplayName(entry.map) : null;
		return (
			<li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
				<span className="flex size-7 shrink-0 items-center justify-center text-subtle-foreground">
					<MapPin size={16} aria-hidden="true" />
				</span>
				<span className="min-w-0 text-sm text-foreground">
					{PHASE_LABEL[entry.phase ?? "ended"]}
					{mapName && <span className="text-muted-foreground"> · {mapName}</span>}
				</span>
				{right}
			</li>
		);
	}

	const questId = entry.questId ?? "";
	const trader = quest?.trader;
	const details = [trader?.name, quest?.map?.name, quest?.minPlayerLevel ? `Lvl ${quest.minPlayerLevel}` : null].filter(
		Boolean,
	);
	return (
		<li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
			{trader?.imageLink ? (
				// eslint-disable-next-line @next/next/no-img-element -- trader portraits come from the data provider
				<img
					src={trader.imageLink}
					alt=""
					className="size-7 shrink-0 rounded-full border border-highlight/10 object-cover"
				/>
			) : (
				<span className="size-7 shrink-0 rounded-full bg-highlight/10" aria-hidden="true" />
			)}
			<div className="min-w-0 flex-1 basis-40">
				{quest ? (
					<QuestLink
						questId={questId}
						quest={quest}
						className="block truncate text-sm font-medium text-foreground hover:text-brand"
					/>
				) : (
					<p className="truncate text-sm">
						<span className="font-mono text-xs text-foreground">{questId}</span>
						<span className="ml-2 text-subtle-foreground">Unknown quest</span>
					</p>
				)}
				{details.length > 0 && <p className="truncate text-xs text-subtle-foreground">{details.join(" · ")}</p>}
			</div>
			{right}
		</li>
	);
}

function ReviewRow({
	profile,
	items,
	active,
	find,
}: {
	profile: ProfileKey;
	items: readonly PendingQuestEvent[];
	active: boolean;
	find: QuestFinder;
}) {
	const [expanded, setExpanded] = useState(false);
	const label = describeProfile(profile);
	return (
		<div className="rounded-md bg-warning/8 px-3 py-2">
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
				<button
					type="button"
					aria-expanded={expanded}
					onClick={() => setExpanded((value) => !value)}
					className="flex min-w-0 items-center gap-1.5 text-left text-foreground"
				>
					<ChevronRight
						size={14}
						className={cn("shrink-0 transition-transform", expanded && "rotate-90")}
						aria-hidden="true"
					/>
					<span>
						Found in Mappinator&apos;s log history · {items.length} {label} {items.length === 1 ? "quest" : "quests"}
					</span>
				</button>
				<span className="ml-auto flex items-center gap-3">
					{active ? (
						<button type="button" onClick={() => applyReview(profile)} className={LINK_BUTTON}>
							Apply
						</button>
					) : (
						<>
							<span className="text-xs text-subtle-foreground">Switch to {label}</span>
							<button type="button" disabled className={LINK_BUTTON}>
								Apply
							</button>
						</>
					)}
					<button type="button" onClick={() => dismissReview(profile)} className={LINK_BUTTON}>
						Dismiss
					</button>
				</span>
			</div>
			{expanded && (
				<ul className="mt-2 space-y-1 pl-5 text-xs">
					{items.map((item) => {
						const quest = find(profile, item.questId);
						return (
							<li key={item.id} className="flex items-center gap-2">
								<Badge variant="flat" size="xs" tone={ACTION_TAG[item.action].tone}>
									{ACTION_TAG[item.action].label}
								</Badge>
								{quest ? (
									<QuestLink
										questId={item.questId}
										quest={quest}
										className="truncate text-foreground hover:text-brand"
									/>
								) : (
									<span className="font-mono text-subtle-foreground">{item.questId}</span>
								)}
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}

const chip = (selected: boolean) =>
	cn(
		"rounded px-2 py-0.5 text-xs font-medium transition-colors",
		selected ? "bg-brand/12 text-brand" : "text-muted-foreground hover:bg-highlight/5 hover:text-foreground",
	);

export function ActivityPanel({ className }: { className?: string }) {
	const hydrated = useSyncHydrated();
	const feed = useCompanionSyncStore((state) => state.feed);
	const batches = useCompanionSyncStore((state) => state.batches);
	const review = useCompanionSyncStore((state) => state.review);
	const gameMode = useUserStore((state) => state.gameMode);
	const selectedSeasonId = useUserStore((state) => state.selectedSeasonId);
	const [view, setView] = useState<"activity" | "raw">("activity");
	const [filter, setFilter] = useState<ProfileKey | null>(null);
	const now = useNow(60_000);
	const active = activeProfileKey(gameMode, selectedSeasonId);

	const profiles = useMemo(() => {
		const present = new Set<ProfileKey>();
		for (const entry of feed) if (entry.profile) present.add(entry.profile);
		return [...present].sort();
	}, [feed]);
	const profileList = useMemo(() => feed.map((entry) => entry.profile), [feed]);
	const find = useQuestFinder(profileList);

	const visible = useMemo(
		() => (filter && profiles.includes(filter) ? feed.filter((entry) => entry.profile === filter) : feed),
		[feed, filter, profiles],
	);
	const groups = useMemo(() => {
		const result: { label: string; entries: FeedEntry[] }[] = [];
		for (const entry of visible) {
			const label = dayLabel(entry.at, now);
			const last = result[result.length - 1];
			if (last?.label === label) last.entries.push(entry);
			else result.push({ label, entries: [entry] });
		}
		return result;
	}, [visible, now]);

	// One Undo per batch, on its first visible row, while that batch's profile is active.
	const undoRows = useMemo(() => {
		const rows = new Map<string, string>();
		const seen = new Set<string>();
		for (const entry of visible) {
			if (!entry.batchId || entry.status !== "applied" || seen.has(entry.batchId)) continue;
			seen.add(entry.batchId);
			const batch = batches[entry.batchId];
			if (batch?.status === "applied" && batch.undo.quests.length > 0 && batch.profile === active) {
				rows.set(entry.id, entry.batchId);
			}
		}
		return rows;
	}, [visible, batches, active]);

	const reviewRows = Object.entries(review).filter(([, items]) => items.length > 0);

	return (
		<section aria-labelledby="sync-activity" className={cn("min-w-0 space-y-3", className)}>
			<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
				<h2 id="sync-activity" className="text-sm font-semibold text-foreground">
					Activity
				</h2>
				{view === "activity" && profiles.length > 0 && (
					<div className="flex items-center gap-1">
						<button type="button" onClick={() => setFilter(null)} className={chip(!filter)}>
							All
						</button>
						{profiles.map((profile) => (
							<button key={profile} type="button" onClick={() => setFilter(profile)} className={chip(filter === profile)}>
								{describeProfile(profile)}
							</button>
						))}
					</div>
				)}
				<div role="group" aria-label="View" className="ml-auto flex items-center rounded-md bg-highlight/5 p-0.5">
					<button
						type="button"
						aria-pressed={view === "activity"}
						onClick={() => setView("activity")}
						className={chip(view === "activity")}
					>
						Activity
					</button>
					<button type="button" aria-pressed={view === "raw"} onClick={() => setView("raw")} className={chip(view === "raw")}>
						Raw
					</button>
				</div>
			</div>

			{view === "raw" ? (
				<RawProtocolView />
			) : !hydrated ? null : (
				<>
					{reviewRows.map(([profile, items]) => (
						<ReviewRow key={profile} profile={profile} items={items} active={profile === active} find={find} />
					))}
					{groups.length === 0 ? (
						<p className="py-6 text-sm text-muted-foreground">No activity yet.</p>
					) : (
						groups.map((group) => (
							<div key={group.label}>
								<h3 className="mb-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-subtle-foreground">
									{group.label}
								</h3>
								<ul className="divide-y divide-highlight/10">
									{group.entries.map((entry) => (
										<EntryRow
											key={entry.id}
											entry={entry}
											quest={entry.questId ? find(entry.profile, entry.questId) : undefined}
											undoBatchId={undoRows.get(entry.id) ?? null}
										/>
									))}
								</ul>
							</div>
						))
					)}
				</>
			)}
		</section>
	);
}
