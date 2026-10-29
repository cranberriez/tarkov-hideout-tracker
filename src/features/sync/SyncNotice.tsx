"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { questWorkspacePageQueryOptions } from "@/lib/query/page-data";
import { useCompanionSyncStore, type RaidNoticeMap } from "@/lib/stores/useCompanionSyncStore";
import { useUserStore } from "@/lib/stores/useUserStore";
import { undoBatch } from "./companion-actions";
import { activeProfileKey, dataModeForProfile, describeNotice, describeProfile, mapDisplayName, type ProfileKey } from "./sync-model";
import { useRaidMapAction } from "./useRaidMapAction";

const NOTICE_MS = 8_000;
/** A raid notice stays longer: the player is usually loading in and alt-tabs back to it. */
const RAID_NOTICE_MS = 20_000;

/** Corner notice for sync: an applied quest batch (with Undo) or a raid starting (with Go to map). */
export function SyncNotice() {
	const notice = useCompanionSyncStore((state) => state.notice);
	const clearNotice = useCompanionSyncStore((state) => state.clearNotice);
	const [hovered, setHovered] = useState(false);
	const nonce = notice?.nonce;
	const duration = notice?.kind === "raid" ? RAID_NOTICE_MS : NOTICE_MS;

	useEffect(() => {
		if (nonce === undefined || hovered) return;
		const timer = setTimeout(clearNotice, duration);
		return () => clearTimeout(timer);
	}, [nonce, hovered, clearNotice, duration]);

	if (!notice) return null;
	return (
		<div
			role="status"
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
			className="fixed bottom-4 right-4 z-50 flex max-w-sm items-center gap-3 rounded-md border border-highlight/10 bg-card px-3 py-2 text-xs text-foreground shadow-md"
		>
			{notice.kind === "raid" ? (
				<RaidStartedBody profile={notice.profile} map={notice.map} onDone={clearNotice} />
			) : (
				<QuestBatchBody batchId={notice.batchId} />
			)}
			<button type="button" aria-label="Dismiss" onClick={clearNotice} className="text-subtle-foreground hover:text-foreground">
				<X size={14} />
			</button>
		</div>
	);
}

function QuestBatchBody({ batchId }: { batchId: string }) {
	const batch = useCompanionSyncStore((state) => state.batches[batchId]);
	const feed = useCompanionSyncStore((state) => state.feed);
	const gameMode = useUserStore((state) => state.gameMode);
	const selectedSeasonId = useUserStore((state) => state.selectedSeasonId);
	const client = useQueryClient();
	if (!batch) return null;

	const label = describeProfile(batch.profile);
	const undone = batch.status === "undone";
	const quests = client.getQueryData(questWorkspacePageQueryOptions(dataModeForProfile(batch.profile)).queryKey)?.quests;
	const names = new Map((quests ?? []).map((quest) => [quest.id, quest.name]));
	const items = feed
		.filter((entry) => entry.batchId === batchId && entry.action && entry.questId)
		.map((entry) => ({ action: entry.action!, name: names.get(entry.questId!) ?? null }));
	const canUndo = !undone && batch.undo.quests.length > 0;
	const isActive = batch.profile === activeProfileKey(gameMode, selectedSeasonId);

	return (
		<>
			<span>
				<span className="text-subtle-foreground">Mappinator · </span>
				{undone ? "Undone" : describeNotice(items, label) || `Updated ${label} quests`}
			</span>
			{canUndo &&
				(isActive ? (
					<button type="button" onClick={() => undoBatch(batchId)} className="font-medium text-brand hover:underline">
						Undo
					</button>
				) : (
					<span className="text-subtle-foreground">switch to {label} to undo</span>
				))}
		</>
	);
}

/** "Raid started" with the one button that takes the player to their raid (see `useRaidMapAction`). */
function RaidStartedBody({
	profile,
	map,
	onDone,
}: {
	profile: ProfileKey | null;
	map: RaidNoticeMap | null;
	onDone: () => void;
}) {
	const action = useRaidMapAction(profile, map, onDone);
	return (
		<>
			<span>
				<span className="text-subtle-foreground">Mappinator · </span>
				Raid started{map ? ` on ${mapDisplayName(map)}` : ""}
				{action.profileLabel ? ` (${action.profileLabel})` : ""}
			</span>
			{action.blocked ? (
				<span className="text-subtle-foreground">activate {action.profileLabel} to switch</span>
			) : (
				action.label && (
					<button type="button" onClick={action.go} className="font-medium text-brand hover:underline">
						{action.label}
					</button>
				)
			)}
		</>
	);
}
