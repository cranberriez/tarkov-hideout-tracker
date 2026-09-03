"use client";

import { useState } from "react";
import type { ItemSummary } from "@/types/items";
import {
    emptyItemNavigation,
    popItemNavigation,
    pushItemNavigation,
    reconcileItemNavigation,
    toItemNavigationEntry,
} from "./item-detail-navigation";

export function useItemDetailNavigationController({
    item,
    isOpen,
    onClose,
}: {
    item: ItemSummary | null;
    isOpen: boolean;
    onClose: () => void;
}) {
    const [storedNavigation, setNavigation] = useState(emptyItemNavigation);
    const [navigatedItemsById, setNavigatedItemsById] = useState<
        Record<string, ItemSummary>
    >({});
    const [debugItemId, setDebugItemId] = useState<string | null>(null);
    const sourceItem = item ? toItemNavigationEntry(item) : null;
    const navigation = reconcileItemNavigation(storedNavigation, sourceItem, isOpen);

    const activeItemId = navigation.entries.at(-1)?.id ?? "";

    return {
        activeItemId,
        navigatedItemsById,
        previousItem: navigation.entries.at(-2) ?? null,
        debugItemId,
        close() {
            setDebugItemId(null);
            setNavigation(emptyItemNavigation);
            setNavigatedItemsById({});
            onClose();
        },
        back() {
            setDebugItemId(null);
            setNavigation(popItemNavigation(navigation));
        },
        navigate(nextItem: ItemSummary) {
            if (nextItem.id === activeItemId) return;
            setDebugItemId(null);
            setNavigatedItemsById((items) => ({ ...items, [nextItem.id]: nextItem }));
            setNavigation(pushItemNavigation(navigation, toItemNavigationEntry(nextItem)));
        },
        toggleDebug(itemId: string) {
            setDebugItemId((current) => (current === itemId ? null : itemId));
        },
    };
}
