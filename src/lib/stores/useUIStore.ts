import { create } from "zustand";
import type { ItemDetails } from "@/types";

export interface PendingItem {
    tempId: string;
    item: ItemDetails;
    nonFir: number;
    fir: number;
}

export interface QuestCascadeRequest {
    mode: "complete" | "uncomplete";
    rootQuestId: string;
    questIds: string[];
    crossTraderQuestIds: string[];
    sensitiveQuestIds: string[];
}

interface UIState {
    isQuickAddOpen: boolean;
    setQuickAddOpen: (isOpen: boolean) => void;
    pendingQuickAddItems: PendingItem[];
    setPendingQuickAddItems: (items: PendingItem[]) => void;
    clearPendingQuickAddItems: () => void;

    questCascadeRequest: QuestCascadeRequest | null;
    openQuestCascadeRequest: (request: QuestCascadeRequest) => void;
    closeQuestCascadeRequest: () => void;
}

export const useUIStore = create<UIState>((set) => ({
    isQuickAddOpen: false,
    setQuickAddOpen: (isOpen) => set({ isQuickAddOpen: isOpen }),
    pendingQuickAddItems: [],
    setPendingQuickAddItems: (items) => set({ pendingQuickAddItems: items }),
    clearPendingQuickAddItems: () => set({ pendingQuickAddItems: [] }),

    questCascadeRequest: null,
    openQuestCascadeRequest: (request) => set({ questCascadeRequest: request }),
    closeQuestCascadeRequest: () => set({ questCascadeRequest: null }),
}));
