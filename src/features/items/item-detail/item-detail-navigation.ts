import type { ItemDetails } from "@/types";

export interface ItemNavigationEntry {
    id: string;
    iconLink?: string;
}

export interface ItemNavigationState {
    sourceItemId: string | null;
    entries: ItemNavigationEntry[];
}

export const emptyItemNavigation: ItemNavigationState = {
    sourceItemId: null,
    entries: [],
};

export function toItemNavigationEntry(item: ItemDetails): ItemNavigationEntry {
    return {
        id: item.id,
        iconLink: item.iconLink ?? item.gridImageLink,
    };
}

export function reconcileItemNavigation(
    navigation: ItemNavigationState,
    sourceItem: ItemNavigationEntry | null,
    isOpen: boolean,
): ItemNavigationState {
    if (!isOpen || !sourceItem) return emptyItemNavigation;
    if (navigation.sourceItemId === sourceItem.id) return navigation;

    const entries =
        navigation.entries.at(-1)?.id === sourceItem.id
            ? navigation.entries
            : [...navigation.entries, sourceItem];

    return {
        sourceItemId: sourceItem.id,
        entries: entries.length > 0 ? entries : [sourceItem],
    };
}

export function pushItemNavigation(
    navigation: ItemNavigationState,
    item: ItemNavigationEntry,
): ItemNavigationState {
    if (navigation.entries.at(-1)?.id === item.id) return navigation;
    return { ...navigation, entries: [...navigation.entries, item] };
}

export function popItemNavigation(navigation: ItemNavigationState): ItemNavigationState {
    if (navigation.entries.length <= 1) return navigation;
    return { ...navigation, entries: navigation.entries.slice(0, -1) };
}
