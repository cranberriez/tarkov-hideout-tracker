"use client";

import { lazy, Suspense } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { ItemDetailModalProps } from "./ItemDetailModal";
import { ItemDetailLoading, ITEM_DETAIL_LOADING_CLASS } from "./ItemDetailLoading";

const LoadedItemDetailModal = lazy(() =>
    import("./ItemDetailModal").then((module) => ({ default: module.ItemDetailModal })),
);

/** Closed item dialogs must not download or initialize the detail/recipe UI. */
export function ItemDetailModal(props: ItemDetailModalProps) {
    if (!props.isOpen || !props.item) return null;

    return (
        <Suspense fallback={
            <Dialog open onOpenChange={(open) => !open && props.onClose()}>
                <DialogContent className={ITEM_DETAIL_LOADING_CLASS} aria-busy="true" aria-describedby={undefined}>
                    <DialogTitle className="sr-only">{props.item.name}</DialogTitle>
                    <ItemDetailLoading item={props.item} />
                </DialogContent>
            </Dialog>
        }>
            <LoadedItemDetailModal {...props} />
        </Suspense>
    );
}
