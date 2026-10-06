"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, CornerDownLeft } from "lucide-react";
import { useUIStore } from "@/lib/stores/useUIStore";
import { useUserStore } from "@/lib/stores/useUserStore";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { ItemSummary } from "@/types/items";
import { toTarkovJsonGameMode } from "@/lib/game-mode";
import { QuickAddSearch } from "./QuickAddSearch";
import { QuickAddItemRow } from "./QuickAddItemRow";
import { addQuickAddPick, hasQuickAddCount } from "./quick-add-model";

export function QuickAddModal() {
	const { isQuickAddOpen, setQuickAddOpen, pendingQuickAddItems, setPendingQuickAddItems, clearPendingQuickAddItems } =
		useUIStore();
	const addItemCounts = useUserStore((state) => state.addItemCounts);
	const gameMode = useUserStore((state) => state.gameMode);
	const [searchQuery, setSearchQuery] = useState("");
	const searchInputRef = useRef<HTMLInputElement>(null);
	const firInputs = useRef(new Map<string, HTMLInputElement>());
	// Row whose FiR input should take focus once the pick has rendered.
	const focusRowAfterRender = useRef<string | null>(null);
	const countedItems = pendingQuickAddItems.filter(hasQuickAddCount);

	useEffect(() => {
		const tempId = focusRowAfterRender.current;
		if (!tempId) return;
		focusRowAfterRender.current = null;
		firInputs.current.get(tempId)?.focus();
	}, [pendingQuickAddItems]);

	const focusSearch = () => searchInputRef.current?.focus();

	const handleOpenChange = (open: boolean) => {
		if (!open) setSearchQuery("");
		setQuickAddOpen(open);
	};

	const handlePick = (item: ItemSummary) => {
		const next = addQuickAddPick(pendingQuickAddItems, item);
		focusRowAfterRender.current = next.tempId;
		setPendingQuickAddItems(next.items);
		setSearchQuery("");
	};

	const handleRemoveItem = (tempId: string) => {
		setPendingQuickAddItems(pendingQuickAddItems.filter((i) => i.tempId !== tempId));
		focusSearch();
	};

	const updateItemCount = (tempId: string, key: "nonFir" | "fir", value: number) => {
		setPendingQuickAddItems(
			pendingQuickAddItems.map((item) => (item.tempId === tempId ? { ...item, [key]: value } : item)),
		);
	};

	const handleSave = () => {
		if (!countedItems.length) return;
		countedItems.forEach((p) => addItemCounts(p.item.id, p.nonFir, p.fir));
		clearPendingQuickAddItems();
		handleOpenChange(false);
	};

	const handleCancel = () => {
		clearPendingQuickAddItems();
		handleOpenChange(false);
	};

	if (!isQuickAddOpen) return null;

	return (
		<Dialog open={isQuickAddOpen} onOpenChange={handleOpenChange}>
			<DialogContent
				className="flex max-h-[80vh] w-full flex-col overflow-hidden border-border-color bg-card p-0 md:max-w-2xl"
				onOpenAutoFocus={(event) => {
					event.preventDefault();
					focusSearch();
				}}
				onEscapeKeyDown={(event) => {
					// First Escape clears a search in progress; the next one closes the dialog.
					if (!searchQuery) return;
					event.preventDefault();
					setSearchQuery("");
					focusSearch();
				}}
				onKeyDown={(event) => {
					if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
						event.preventDefault();
						handleSave();
					}
				}}
			>
				<div className="border-b border-border-color bg-shadow/40 p-4">
					<DialogTitle className="text-lg font-semibold">Add Items from Raid</DialogTitle>
					<DialogDescription className="sr-only">
						Search for an item and press Enter to add one found-in-raid. Type a count and press Enter to return to the
						search. Press Control and Enter to save.
					</DialogDescription>
				</div>

				<div className="min-h-[50vh] flex-1 space-y-3 overflow-y-auto p-4">
					<QuickAddSearch
						mode={toTarkovJsonGameMode(gameMode)}
						query={searchQuery}
						onQueryChange={setSearchQuery}
						onPick={handlePick}
						inputRef={searchInputRef}
					/>

					{pendingQuickAddItems.map((pending) => (
						<QuickAddItemRow
							key={pending.tempId}
							pending={pending}
							onCountChange={(key, value) => updateItemCount(pending.tempId, key, value)}
							onRemove={() => handleRemoveItem(pending.tempId)}
							onDone={focusSearch}
							firInputRef={(element) => {
								if (element) firInputs.current.set(pending.tempId, element);
								else firInputs.current.delete(pending.tempId);
							}}
						/>
					))}
				</div>

				<div className="flex items-center justify-between gap-3 border-t border-border-color bg-shadow/40 p-4">
					<span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
						<ArrowUp size={12} />
						<ArrowDown size={12} /> Select
						<CornerDownLeft size={12} className="ml-2" /> Add
						<kbd className="ml-2 rounded border border-border-color px-1">Ctrl+Enter</kbd> Save
					</span>
					<div className="ml-auto flex gap-3">
						<button
							type="button"
							onClick={handleCancel}
							className="px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={handleSave}
							disabled={countedItems.length === 0}
							className="rounded bg-brand px-4 py-2 text-sm font-bold text-inverse shadow-[0_0_10px_color-mix(in_oklab,_var(--brand)_20%,_transparent)] transition-all hover:bg-brand-hover hover:shadow-[0_0_15px_color-mix(in_oklab,_var(--brand)_30%,_transparent)] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
						>
							Add {countedItems.length} Item{countedItems.length !== 1 ? "s" : ""}
						</button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
