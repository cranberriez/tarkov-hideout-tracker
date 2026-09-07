"use client";

import Image from "next/image";
import { PackageOpen } from "lucide-react";
import type { ItemSummary } from "@/types/items";
import styles from "./ItemDetailLoading.module.css";

export const ITEM_DETAIL_LOADING_CLASS = "w-[calc(100%-2rem)] max-w-sm overflow-hidden p-0 transition-[max-width] duration-200 motion-reduce:transition-none";

export function ItemDetailLoading({ item }: { item: ItemSummary }) {
    const image = item.image512pxLink ?? item.gridImageLink ?? item.iconLink ?? item.baseImageLink;
    return (
        <div className="flex flex-col items-center px-8 pb-8 pt-10 text-center">
            <div className="mb-5 flex h-28 w-28 items-center justify-center rounded-lg border border-border-color bg-black/30 p-3">
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
