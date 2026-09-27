import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Compact status label. Keep meanings distinct: `success` for completed/satisfied,
 * `warning` for FiR and unmet prerequisites, `danger` for locked/failed, `info`
 * for active states, `special` for milestones, and `brand` for selection/levels.
 */
export type BadgeTone = "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "special";
export type BadgeSize = "xs" | "sm" | "md";

const tones: Record<BadgeTone, string> = {
    neutral: "border-highlight/12 bg-highlight/5 text-muted-foreground",
    brand: "border-brand/25 bg-brand/8 text-brand",
    success: "border-success/25 bg-success/8 text-success",
    warning: "border-warning/25 bg-warning/8 text-warning",
    danger: "border-danger/25 bg-danger/8 text-danger",
    info: "border-info/25 bg-info/8 text-info",
    special: "border-special/25 bg-special/8 text-special",
};

const sizes: Record<BadgeSize, string> = {
    xs: "gap-1 px-1.5 py-px text-[9px] [&_svg]:size-2.5",
    sm: "gap-1 px-2 py-0.5 text-[10px] [&_svg]:size-3",
    md: "gap-1.5 px-2.5 py-1 text-[11px] [&_svg]:size-3.5",
};

export function badgeClassName({ tone = "neutral", size = "sm", className }: { tone?: BadgeTone; size?: BadgeSize; className?: string } = {}) {
    return cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-sm border font-semibold uppercase leading-none tracking-wider [&_svg]:shrink-0",
        tones[tone],
        sizes[size],
        className,
    );
}

export function Badge({
    tone,
    size,
    className,
    ...props
}: ComponentProps<"span"> & { tone?: BadgeTone; size?: BadgeSize }) {
    return <span {...props} className={badgeClassName({ tone, size, className })} />;
}
