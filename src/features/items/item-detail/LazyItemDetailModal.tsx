"use client";

import { lazy, Suspense } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { ItemDetailModalProps } from "./ItemDetailModal";

const LoadedItemDetailModal = lazy(() =>
    import("./ItemDetailModal").then((module) => ({ default: module.ItemDetailModal })),
);

/** Closed item dialogs must not download or initialize the detail/recipe UI. */
export function ItemDetailModal(props: ItemDetailModalProps) {
    if (!props.isOpen || !props.item) return null;

    return (
        <Suspense fallback={
            <Dialog open onOpenChange={(open) => !open && props.onClose()}>
                <DialogContent className="p-6" aria-busy="true">
                    <DialogTitle>{props.item.name}</DialogTitle>
                    <DialogDescription role="status" className="mt-3">
                        Loading item details…
                    </DialogDescription>
                </DialogContent>
            </Dialog>
        }>
            <LoadedItemDetailModal {...props} />
        </Suspense>
    );
}
