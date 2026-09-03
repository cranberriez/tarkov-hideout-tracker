"use client";

import { useEffect, useState } from "react";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { isCompleteItemUsageData } from "@/lib/utils/item-usage";
import type {
    ItemAcquisitionTreeData,
    ItemRelationsPayload,
    ItemUsageData,
} from "@/types/contracts";
import {
    getItemRelationsError,
    hasCompleteItemRelations,
} from "./item-detail-data";

const itemRelationsCache = new Map<string, ItemRelationsPayload>();
const itemUsageCache = new Map<string, ItemUsageData>();
const acquisitionTreeCache = new Map<string, ItemAcquisitionTreeData>();

type DataResult<T> = { key: string; data: T } | null;
type ErrorResult = { key: string; message: string } | null;

function isAbortError(error: unknown) {
    return error instanceof DOMException && error.name === "AbortError";
}

export function useItemDetailRequestController({
    activeItemId,
    isOpen,
    mode,
}: {
    activeItemId: string;
    isOpen: boolean;
    mode: TarkovJsonGameMode;
}) {
    const requestKey = `${mode}:${activeItemId}`;
    const [relationsResult, setRelationsResult] = useState<DataResult<ItemRelationsPayload>>(null);
    const [relationsErrorResult, setRelationsErrorResult] = useState<ErrorResult>(null);
    const [usageResult, setUsageResult] = useState<DataResult<ItemUsageData>>(null);
    const [usageErrorResult, setUsageErrorResult] = useState<ErrorResult>(null);
    const [treeResult, setTreeResult] = useState<DataResult<ItemAcquisitionTreeData>>(null);
    const [treeErrorResult, setTreeErrorResult] = useState<ErrorResult>(null);

    useEffect(() => {
        if (!isOpen || !activeItemId || itemRelationsCache.has(requestKey)) return;
        const controller = new AbortController();
        fetch(`/api/items/${encodeURIComponent(activeItemId)}/relations?mode=${mode}`, {
            signal: controller.signal,
        })
            .then(async (response) => {
                if (!response.ok) throw new Error(`Item relations request failed (${response.status})`);
                return (await response.json()) as ItemRelationsPayload;
            })
            .then((data) => {
                if (hasCompleteItemRelations(data)) itemRelationsCache.set(requestKey, data);
                setRelationsErrorResult(null);
                setRelationsResult({ key: requestKey, data });
            })
            .catch((error: unknown) => {
                if (!isAbortError(error)) {
                    setRelationsErrorResult({
                        key: requestKey,
                        message: "Hideout and quest relations could not be loaded.",
                    });
                }
            });
        return () => controller.abort();
    }, [activeItemId, isOpen, mode, requestKey]);

    useEffect(() => {
        if (!isOpen || !activeItemId || itemUsageCache.has(requestKey)) return;
        const controller = new AbortController();
        fetch(`/api/items/${encodeURIComponent(activeItemId)}/usage?mode=${mode}`, {
            signal: controller.signal,
        })
            .then(async (response) => {
                if (!response.ok) throw new Error(`Item usage request failed (${response.status})`);
                return (await response.json()) as ItemUsageData;
            })
            .then((data) => {
                if (isCompleteItemUsageData(data)) itemUsageCache.set(requestKey, data);
                setUsageErrorResult(null);
                setUsageResult({ key: requestKey, data });
            })
            .catch((error: unknown) => {
                if (!isAbortError(error)) {
                    setUsageErrorResult({
                        key: requestKey,
                        message: "Trader and crafting data could not be loaded.",
                    });
                }
            });
        return () => controller.abort();
    }, [activeItemId, isOpen, mode, requestKey]);

    useEffect(() => {
        if (!isOpen || !activeItemId || acquisitionTreeCache.has(requestKey)) return;
        const controller = new AbortController();
        fetch(`/api/items/${encodeURIComponent(activeItemId)}/acquisition-tree?mode=${mode}`, {
            signal: controller.signal,
        })
            .then(async (response) => {
                if (!response.ok) throw new Error(`Acquisition tree request failed (${response.status})`);
                return (await response.json()) as ItemAcquisitionTreeData;
            })
            .then((data) => {
                if (Object.values(data.errors).every((error) => error === null)) {
                    acquisitionTreeCache.set(requestKey, data);
                }
                setTreeErrorResult(null);
                setTreeResult({ key: requestKey, data });
            })
            .catch((error: unknown) => {
                if (!isAbortError(error)) {
                    setTreeErrorResult({
                        key: requestKey,
                        message: "Profit recommendations could not be loaded.",
                    });
                }
            });
        return () => controller.abort();
    }, [activeItemId, isOpen, mode, requestKey]);

    const relations =
        itemRelationsCache.get(requestKey) ??
        (relationsResult?.key === requestKey ? relationsResult.data : null);
    const relationsRequestError =
        relationsErrorResult?.key === requestKey ? relationsErrorResult.message : null;
    const usage =
        itemUsageCache.get(requestKey) ??
        (usageResult?.key === requestKey ? usageResult.data : null);
    const usageError = usageErrorResult?.key === requestKey ? usageErrorResult.message : null;
    const tree =
        acquisitionTreeCache.get(requestKey) ??
        (treeResult?.key === requestKey ? treeResult.data : null);
    const treeRequestError = treeErrorResult?.key === requestKey ? treeErrorResult.message : null;
    const treeDomainError = tree
        ? Object.values(tree.errors).filter(Boolean).join(" ") || null
        : null;

    return {
        relations,
        relationsError: getItemRelationsError(relations, relationsRequestError),
        relationsLoading:
            isOpen && activeItemId.length > 0 && relations === null && relationsRequestError === null,
        usage,
        usageError,
        usageLoading:
            isOpen && activeItemId.length > 0 && usage === null && usageError === null,
        tree,
        treeError: treeRequestError ?? treeDomainError,
        treeLoading:
            isOpen && activeItemId.length > 0 && tree === null && treeRequestError === null,
    };
}
