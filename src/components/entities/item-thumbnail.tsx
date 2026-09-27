import Image from "next/image";
import type { ReactNode } from "react";
import { PackageOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export type ItemThumbnailSize = "xs" | "sm" | "md" | "lg";

const pixels: Record<ItemThumbnailSize, number> = { xs: 20, sm: 32, md: 44, lg: 64 };
const boxes: Record<ItemThumbnailSize, string> = {
    xs: "size-5",
    sm: "size-8",
    md: "size-11",
    lg: "size-16",
};

export interface ThumbnailItem {
    name: string;
    iconLink?: string | null;
    gridImageLink?: string | null;
}

/** Item icon with a stable box and explicit missing-image placeholder. */
export function ItemThumbnail({
    item,
    size = "md",
    framed = false,
    className,
    children,
}: {
    item: ThumbnailItem;
    size?: ItemThumbnailSize;
    /** Adds the neutral inventory-slot frame. */
    framed?: boolean;
    className?: string;
    /** Overlays such as quantity or FiR badges. */
    children?: ReactNode;
}) {
    const src = item.iconLink ?? item.gridImageLink;
    return (
        <span
            className={cn(
                "relative flex shrink-0 items-center justify-center",
                boxes[size],
                framed && "rounded-sm border border-highlight/12 bg-shadow/30",
                className,
            )}
        >
            {src ? (
                <Image src={src} alt="" width={pixels[size]} height={pixels[size]} unoptimized className="size-full object-contain" />
            ) : (
                <PackageOpen aria-hidden="true" className="size-1/2 text-subtle-foreground" />
            )}
            {children}
        </span>
    );
}

/** Bottom-right count overlay for an `ItemThumbnail`. */
export function ItemQuantityBadge({ label, className }: { label: string; className?: string }) {
    return (
        <span className={cn(
            "absolute -bottom-1 -right-1 inline-flex min-w-5 items-center justify-center rounded bg-background px-1.5 py-0.5 font-mono text-xs font-bold leading-none text-foreground shadow-sm ring-1 ring-highlight/15",
            className,
        )}>
            {label}
        </span>
    );
}
