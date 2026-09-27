"use client";

import { useQuery } from "@tanstack/react-query";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { useGameDataEnabled } from "@/lib/query/game-data";
import {
    PartialDataError,
} from "@/lib/query/request";
import type { ItemAcquisitionTreeData, ItemRelationsPayload, ItemUsageData } from "@/types/contracts";
import { getItemRelationsError } from "./item-detail-data";
import { itemAcquisitionQueryOptions, itemRelationsQueryOptions, itemUsageQueryOptions } from "./item-detail-queries";

function partialPayload<T>(error: Error | null): T | null {
    return error instanceof PartialDataError ? (error.payload as T) : null;
}

function requestMessage(error: Error | null, fallback: string): string | null {
    if (!error || error instanceof PartialDataError) return null;
    return fallback;
}

/** Server-rendered payloads for the active item; complete views are hydrated into the query cache instead. */
export interface InitialItemDetailViews {
    relations?: ItemRelationsPayload | null;
    usage?: ItemUsageData | null;
    tree?: ItemAcquisitionTreeData | null;
}

export function useItemDetailRequestController({ activeItemId, isOpen, mode, initial }: {
    activeItemId: string;
    isOpen: boolean;
    mode: TarkovJsonGameMode;
    initial?: InitialItemDetailViews;
}) {
    const gameDataEnabled = useGameDataEnabled(mode);
    const enabled = isOpen && activeItemId.length > 0 && gameDataEnabled;
    const relationsQuery = useQuery({ ...itemRelationsQueryOptions(mode, activeItemId), enabled });
    const usageQuery = useQuery({ ...itemUsageQueryOptions(mode, activeItemId), enabled });
    const treeQuery = useQuery({ ...itemAcquisitionQueryOptions(mode, activeItemId), enabled });

    // Keys are mode-scoped, so hydrated or cached data renders before the saved profile
    // loads (including on the server); the profile gate only controls fetching.
    const relations = partialPayload<ItemRelationsPayload>(relationsQuery.error) ?? relationsQuery.data ?? initial?.relations ?? null;
    const usage = partialPayload<ItemUsageData>(usageQuery.error) ?? usageQuery.data ?? initial?.usage ?? null;
    const tree = partialPayload<ItemAcquisitionTreeData>(treeQuery.error) ?? treeQuery.data ?? initial?.tree ?? null;
    const relationsRequestError = requestMessage(relationsQuery.error, "Hideout and quest relations could not be loaded.");
    const usageRequestError = requestMessage(usageQuery.error, "Trader and crafting data could not be loaded.");
    const treeRequestError = requestMessage(treeQuery.error, "Profit recommendations could not be loaded.");
    const treeDomainError = tree ? Object.values(tree.errors).filter(Boolean).join(" ") || null : null;
    const waitingForScope = isOpen && activeItemId.length > 0 && !gameDataEnabled;
    const waiting = (data: unknown) => waitingForScope && data === null;

    return {
        relations,
        relationsError: getItemRelationsError(relations, relationsRequestError),
        relationsLoading: waiting(relations) || (enabled && relations === null && relationsQuery.isPending),
        retryRelations: () => relationsQuery.refetch(),
        usage,
        usageError: usageRequestError,
        usageLoading: waiting(usage) || (enabled && usage === null && usageQuery.isPending),
        retryUsage: () => usageQuery.refetch(),
        tree,
        treeError: treeRequestError ?? treeDomainError,
        treeLoading: waiting(tree) || (enabled && tree === null && treeQuery.isPending),
        retryTree: () => treeQuery.refetch(),
    };
}
