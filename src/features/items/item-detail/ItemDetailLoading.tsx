"use client";

import Image from "next/image";
import { PackageOpen, X } from "lucide-react";
import type { ItemSummary } from "@/types/items";
import styles from "./ItemDetailLoading.module.css";

export const ITEM_DETAIL_LOADING_CLASS = "pointer-events-auto relative mx-auto w-full max-w-sm overflow-hidden rounded-lg border border-border-color bg-card shadow-2xl transition-[max-width] duration-200 motion-reduce:transition-none";

export function ItemDetailLoading({ item, onClose }: { item: ItemSummary; onClose: () => void }) {
    const image = item.image512pxLink ?? item.gridImageLink ?? item.iconLink ?? item.baseImageLink;
    return (
        <div className="flex flex-col items-center px-8 pb-8 pt-10 text-center">
            <button
                type="button"
                onClick={onClose}
                className="absolute right-4 top-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2"
                aria-label="Close item details"
            >
                <X className="size-4" />
            </button>
            <div className="mb-5 flex h-28 w-28 items-center justify-center rounded-lg border border-border-color bg-shadow/30 p-3">
                {image
                    ? <Image src={image} alt="" width={112} height={112} unoptimized className="h-full w-full object-contain" />
                    : <PackageOpen size={40} className="text-muted-foreground" />}
            </div>
            <p className="max-w-full break-words text-sm font-semibold text-foreground">{item.name}</p>
            <div role="status" className="mt-5 w-full">
                <div aria-hidden="true" className={styles.track}><div className={styles.signal} /></div>
                <p className="mt-3 text-xs text-muted-foreground">Loading item details…</p>
            </div>
        </div>
    );
}
