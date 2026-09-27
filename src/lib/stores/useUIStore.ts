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

	/** Item shown by the global item-detail dialog; opening another while open pushes dialog history. */
	itemDetailItem: ItemSummary | null;
	/** Summaries opened during this dialog session, so Back can show earlier items immediately. */
	itemDetailKnownItems: Record<string, ItemSummary>;
	openItemDetail: (item: ItemSummary) => void;
	closeItemDetail: () => void;
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
	setLegacyProfileConversionOpen: (isOpen) => set({ isLegacyProfileConversionOpen: isOpen }),

	itemDetailItem: null,
	itemDetailKnownItems: {},
	openItemDetail: (item) =>
		set((state) => {
			const known = state.itemDetailItem ? state.itemDetailKnownItems : {};
			// Keep richer summaries (prices, categories) over partial link data.
			const merged = { ...item, ...known[item.id], ...stripUndefined(item) };
			return { itemDetailItem: merged, itemDetailKnownItems: { ...known, [item.id]: merged } };
		}),
	closeItemDetail: () => set({ itemDetailItem: null, itemDetailKnownItems: {} }),
}));

function stripUndefined<T extends object>(value: T): Partial<T> {
	return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
}
