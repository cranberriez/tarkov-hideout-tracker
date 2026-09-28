"use client";

import { lazy, Suspense } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { ItemDetailModalProps } from "./ItemDetailModal";
import { ItemDetailLoading, ITEM_DETAIL_LOADING_CLASS } from "./ItemDetailLoading";

const LoadedItemDetailModal = lazy(() =>
	import("./ItemDetailModal").then((module) => ({ default: module.ItemDetailModalContent })),
);

/** Closed item dialogs must not download or initialize the detail/recipe UI. */
export function ItemDetailModal(props: ItemDetailModalProps) {
	if (!props.isOpen || !props.item) return null;

	return (
		<Dialog open onOpenChange={(open) => !open && props.onClose()}>
			<DialogContent
				showCloseButton={false}
				aria-describedby={undefined}
				className="pointer-events-none w-full overflow-visible border-0 bg-transparent p-0 shadow-none outline-none max-lg:pointer-events-auto max-lg:top-0 max-lg:left-0 max-lg:h-dvh max-lg:max-w-none max-lg:translate-x-0 max-lg:translate-y-0 max-lg:overflow-x-hidden max-lg:overflow-y-auto max-lg:rounded-none max-lg:bg-background lg:max-w-5xl"
			>
				<Suspense
					fallback={
						<div className={ITEM_DETAIL_LOADING_CLASS} aria-busy="true">
							<DialogTitle className="sr-only">{props.item.name}</DialogTitle>
							<ItemDetailLoading item={props.item} onClose={props.onClose} />
						</div>
					}
				>
					<LoadedItemDetailModal {...props} />
				</Suspense>
			</DialogContent>
		</Dialog>
	);
}
