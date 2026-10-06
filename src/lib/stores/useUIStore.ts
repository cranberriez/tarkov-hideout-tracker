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
	/** The pending conversion dialog was closed without Skip/Confirm; stops auto-open until reload. */
	isLegacyProfileConversionDeferred: boolean;
	deferLegacyProfileConversion: () => void;

	/** View shown by the global item-detail dialog; opening another while open pushes dialog history. */
	itemDetailEntry: ItemDetailEntry | null;
	/** Summaries opened during this dialog session, so Back can show earlier items immediately. */
	itemDetailKnownItems: Record<string, ItemSummary>;
	openItemDetail: (item: ItemSummary) => void;
	/** Replace the dialog's item view with a recipe's profit breakdown (Back returns). */
	openRecipeBreakdown: (recipe: RecipeBreakdownTarget) => void;
	/** Show a view restored from dialog history. */
	showItemDetailEntry: (entry: ItemDetailEntry) => void;
	closeItemDetail: () => void;
}

/** A recipe whose profit breakdown replaces the item view; `outputItem` labels Back and loads its graph. */
export interface RecipeBreakdownTarget {
	kind: "barter" | "craft";
	recipeId: string;
	outputItem: ItemSummary;
}

/** One dialog view: an item, or a recipe breakdown reached from an item. */
export type ItemDetailEntry = { kind: "item"; item: ItemSummary } | { kind: "recipe"; recipe: RecipeBreakdownTarget };

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
	isLegacyProfileConversionDeferred: false,
	deferLegacyProfileConversion: () =>
		set({ isLegacyProfileConversionOpen: false, isLegacyProfileConversionDeferred: true }),

	itemDetailEntry: null,
	itemDetailKnownItems: {},
	openItemDetail: (item) =>
		set((state) => {
			const known = state.itemDetailEntry ? state.itemDetailKnownItems : {};
			// Keep richer summaries (prices, categories) over partial link data.
			const merged = { ...item, ...known[item.id], ...stripUndefined(item) };
			return { itemDetailEntry: { kind: "item", item: merged }, itemDetailKnownItems: { ...known, [item.id]: merged } };
		}),
	openRecipeBreakdown: (recipe) => set({ itemDetailEntry: { kind: "recipe", recipe } }),
	showItemDetailEntry: (entry) =>
		entry.kind === "item" ? useUIStore.getState().openItemDetail(entry.item) : set({ itemDetailEntry: entry }),
	closeItemDetail: () => set({ itemDetailEntry: null, itemDetailKnownItems: {} }),
}));

function stripUndefined<T extends object>(value: T): Partial<T> {
	return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
}
