"use client";

import { useUIStore } from "@/lib/stores/useUIStore";
import { ItemDetailModal } from "./LazyItemDetailModal";

/** The single item-detail dialog. Every item link and search result opens it via `openItemDetail`. */
export function GlobalItemDetailModal() {
    const item = useUIStore((state) => state.itemDetailItem);
    const close = useUIStore((state) => state.closeItemDetail);
    return <ItemDetailModal item={item} isOpen={!!item} onClose={close} />;
}
