import { create } from "zustand";
import type { ItemSummary } from "@/types/items";

export interface PendingItem {
    tempId: string;
    item: ItemSummary;
    nonFir: number;
    fir: number;
}

export interface QuestCascadeRequest {
    mode: "complete" | "uncomplete";
    rootQuestId: string;
    questIds: string[];
    autoFailedQuestIds?: string[];
    rootAutoFailedQuestIds?: string[];
    crossTraderQuestIds: string[];
    sensitiveQuestIds: string[];
}

interface UIState {
    isMainNavHidden: boolean;
    setMainNavHidden: (isHidden: boolean) => void;

    isQuickAddOpen: boolean;
    setQuickAddOpen: (isOpen: boolean) => void;
    pendingQuickAddItems: PendingItem[];
    setPendingQuickAddItems: (items: PendingItem[]) => void;
    clearPendingQuickAddItems: () => void;

    questCascadeRequest: QuestCascadeRequest | null;
    openQuestCascadeRequest: (request: QuestCascadeRequest) => void;
    closeQuestCascadeRequest: () => void;

    isLegacyProfileConversionOpen: boolean;
    setLegacyProfileConversionOpen: (isOpen: boolean) => void;

}

export const useUIStore = create<UIState>((set) => ({
    isMainNavHidden: false,
    setMainNavHidden: (isHidden) => set({ isMainNavHidden: isHidden }),

    isQuickAddOpen: false,
    setQuickAddOpen: (isOpen) => set({ isQuickAddOpen: isOpen }),
    pendingQuickAddItems: [],
    setPendingQuickAddItems: (items) => set({ pendingQuickAddItems: items }),
    clearPendingQuickAddItems: () => set({ pendingQuickAddItems: [] }),

    questCascadeRequest: null,
    openQuestCascadeRequest: (request) => set({ questCascadeRequest: request }),
    closeQuestCascadeRequest: () => set({ questCascadeRequest: null }),

    isLegacyProfileConversionOpen: false,
    setLegacyProfileConversionOpen: (isOpen) =>
        set({ isLegacyProfileConversionOpen: isOpen }),

}));
