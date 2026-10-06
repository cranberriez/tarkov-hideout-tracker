import { queryOptions } from "@tanstack/react-query";
import type { TarkovJsonGameMode } from "../game-mode";
import type { QuestDetailsData } from "@/types/quest-workspace";
import type { FullQuest } from "@/types/quests";
import type { ItemSummary } from "@/types/items";
import { getQuestWorkspaceItemIds } from "../quests/quest-item-ids";
import { fetchJson, PartialDataError } from "./request";
import { gameDataKey } from "./scope";

export interface QuestDetailData {
	quest: FullQuest | null;
	items: ItemSummary[] | null;
	unresolvedItemIds: string[];
	error: string | null;
	itemsError: string | null;
}

export function selectQuestDetailData(data: QuestDetailsData, id: string): QuestDetailData {
	const quest = data.quests?.find((entry) => entry.id === id) ?? null;
	const ids = new Set(quest ? getQuestWorkspaceItemIds([quest]) : []);
	return {
		quest,
		items: data.items?.filter((item) => ids.has(item.id)) ?? null,
		unresolvedItemIds: data.unresolvedItemIds.filter((itemId) => ids.has(itemId)),
		error: data.errors.quests,
		itemsError: data.errors.items,
	};
}

interface PendingQuest {
	id: string;
	signal: AbortSignal;
	resolve: (data: QuestDetailData) => void;
	reject: (error: unknown) => void;
}
const pending = new Map<string, PendingQuest[]>();

/** Coalesce simultaneous per-quest queries. Batch combinations never become client cache keys. */
function requestQuest(mode: TarkovJsonGameMode, id: string, devQuery: string | null, signal: AbortSignal) {
	return new Promise<QuestDetailData>((resolve, reject) => {
		const key = JSON.stringify([mode, devQuery]);
		const existing = pending.get(key);
		const entry = { id, signal, resolve, reject };
		if (existing) {
			existing.push(entry);
			return;
		}
		pending.set(key, [entry]);
		queueMicrotask(() => {
			const queued = pending.get(key) ?? [];
			pending.delete(key);
			const active = queued.filter((request) => {
				if (!request.signal.aborted) return true;
				request.reject(new DOMException("Aborted", "AbortError"));
				return false;
			});
			for (let offset = 0; offset < active.length; offset += 50) {
				const batch = active.slice(offset, offset + 50);
				const ids = [...new Set(batch.map((request) => request.id))].sort();
				const params = new URLSearchParams({ mode, ids: ids.join(",") });
				if (devQuery) params.set("q", devQuery);
				// One cancelled observer must not abort another quest's shared request.
				void fetchJson<QuestDetailsData>(`/api/quests/details?${params}`)
					.then((data) => {
						for (const request of batch) {
							if (request.signal.aborted) {
								request.reject(new DOMException("Aborted", "AbortError"));
								continue;
							}
							const detail = selectQuestDetailData(data, request.id);
							if (detail.error || detail.itemsError)
								request.reject(new PartialDataError("Some quest details are unavailable.", detail));
							else request.resolve(detail);
						}
					})
					.catch((error: unknown) => batch.forEach((request) => request.reject(error)));
			}
		});
	});
}

export function questDetailQueryOptions(mode: TarkovJsonGameMode, questId: string, devQuery: string | null = null) {
	return queryOptions({
		queryKey: gameDataKey(mode, "quest-detail", "v1", devQuery, questId),
		queryFn: ({ signal }) => requestQuest(mode, questId, devQuery, signal),
		staleTime: 5 * 60 * 1000,
		retry: false,
		meta: { retentionGroup: "quest-details", inactiveQueryLimit: 100 },
	});
}
