import { create } from "zustand";
import type { ItemDetails } from "@/types";

export interface PendingItem {
    tempId: string;
    item: ItemDetails;
    nonFir: number;
    fir: number;
}

interface UIState {
    isQuickAddOpen: boolean;
    setQuickAddOpen: (isOpen: boolean) => void;
    pendingQuickAddItems: PendingItem[];
    setPendingQuickAddItems: (items: PendingItem[]) => void;
    clearPendingQuickAddItems: () => void;
}

export const useUIStore = create<UIState>((set) => ({
    isQuickAddOpen: false,
    setQuickAddOpen: (isOpen) => set({ isQuickAddOpen: isOpen }),
    pendingQuickAddItems: [],
    setPendingQuickAddItems: (items) => set({ pendingQuickAddItems: items }),
    clearPendingQuickAddItems: () => set({ pendingQuickAddItems: [] }),
}));
