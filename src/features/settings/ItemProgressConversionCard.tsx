"use client";

import { useState } from "react";
import { CompletedItemsConversionModal } from "@/features/items/components/CompletedItemsConversionModal";

export function ItemProgressConversionCard() {
    const [isConversionOpen, setIsConversionOpen] = useState(false);

    return (
        <>
            <div className="bg-card border rounded-lg p-4 sm:p-5 space-y-3">
                <div className="text-sm font-medium text-white">Item progress conversion</div>
                <div className="text-xs text-gray-400 max-w-md">
                    Re-open the item progress update dialog to convert previously completed hideout
                    requirements into per-item counts.
                </div>
                <button
                    type="button"
                    onClick={() => setIsConversionOpen(true)}
                    className="inline-flex items-center px-3 py-1.5 text-xs sm:text-sm rounded-md border border-foreground/30 bg-foreground/10 hover:bg-foreground/20 text-white transition-colors"
                >
                    Open conversion dialog
                </button>
            </div>

            <CompletedItemsConversionModal
                isOpen={isConversionOpen}
                onClose={() => setIsConversionOpen(false)}
            />
        </>
    );
}
