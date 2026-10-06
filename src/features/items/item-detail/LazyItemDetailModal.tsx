"use client";

import { lazy, Suspense } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ItemDetailLoading, ITEM_DETAIL_LOADING_CLASS } from "./ItemDetailLoading";
import type { ItemDetailEntry } from "./item-detail-navigation";

const LoadedItemDetailModal = lazy(() =>
	import("./ItemDetailModal").then((module) => ({ default: module.ItemDetailModalContent })),
);
const LoadedRecipeBreakdown = lazy(() =>
	import("./RecipeBreakdownModal").then((module) => ({ default: module.RecipeBreakdownContent })),
);

export interface ItemDetailDialogProps {
	entry: ItemDetailEntry | null;
	previousEntry: ItemDetailEntry | null;
	onBack: () => void;
	onClose: () => void;
}

/**
 * The one item dialog: an item view or a recipe breakdown swaps its content (never stacked).
 * Closed dialogs must not download or initialize the detail/recipe UI.
 */
export function ItemDetailModal({ entry, previousEntry, onBack, onClose }: ItemDetailDialogProps) {
	if (!entry) return null;
	const placeholderItem = entry.kind === "item" ? entry.item : entry.recipe.outputItem;

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent
				showCloseButton={false}
				aria-describedby={undefined}
				className="pointer-events-none w-full overflow-visible border-0 bg-transparent p-0 shadow-none outline-none max-lg:pointer-events-auto max-lg:top-0 max-lg:left-0 max-lg:h-dvh max-lg:max-w-none max-lg:translate-x-0 max-lg:translate-y-0 max-lg:overflow-x-hidden max-lg:overflow-y-auto max-lg:rounded-none max-lg:bg-background lg:max-w-5xl"
			>
				<Suspense
					fallback={
						<div className={ITEM_DETAIL_LOADING_CLASS} aria-busy="true">
							<DialogTitle className="sr-only">{placeholderItem.name}</DialogTitle>
							<ItemDetailLoading item={placeholderItem} onClose={onClose} />
						</div>
					}
				>
					{entry.kind === "item" ? (
						<LoadedItemDetailModal
							item={entry.item}
							isOpen
							previousEntry={previousEntry}
							onBack={onBack}
							onClose={onClose}
						/>
					) : (
						<LoadedRecipeBreakdown
							key={`${entry.recipe.kind}:${entry.recipe.recipeId}`}
							recipe={entry.recipe}
							previousEntry={previousEntry}
							onBack={onBack}
							onClose={onClose}
						/>
					)}
				</Suspense>
			</DialogContent>
		</Dialog>
	);
}
