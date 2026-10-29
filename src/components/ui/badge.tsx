import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Compact status label. Keep meanings distinct: `success` for completed/satisfied,
 * `fir` for found-in-raid, `warning` for unmet prerequisites, `danger` for locked/failed,
 * `info` for active states, `special` for milestones, and `brand` for selection/levels.
 * `outline` is the dense uppercase label; `flat` is a borderless, sentence-case label for
 * reading-focused views.
 */
export type BadgeTone = "neutral" | "brand" | "success" | "fir" | "warning" | "danger" | "info" | "special";
export type BadgeSize = "xs" | "sm" | "md";
export type BadgeVariant = "outline" | "flat";

const tones: Record<BadgeTone, string> = {
	neutral: "border-highlight/12 bg-highlight/5 text-muted-foreground",
	brand: "border-brand/25 bg-brand/8 text-brand",
	success: "border-success/25 bg-success/8 text-success",
	fir: "border-fir/25 bg-fir/8 text-fir",
	warning: "border-warning/25 bg-warning/8 text-warning",
	danger: "border-danger/25 bg-danger/8 text-danger",
	info: "border-info/25 bg-info/8 text-info",
	special: "border-special/25 bg-special/8 text-special",
};

// Without a border, flat badges need a stronger fill to read as a shape.
const flatTones: Record<BadgeTone, string> = {
	neutral: "bg-highlight/10 text-muted-foreground",
	brand: "bg-brand/12 text-brand",
	success: "bg-success/12 text-success",
	fir: "bg-fir/12 text-fir",
	warning: "bg-warning/12 text-warning",
	danger: "bg-danger/12 text-danger",
	info: "bg-info/12 text-info",
	special: "bg-special/12 text-special",
};

const sizes: Record<BadgeSize, string> = {
	xs: "gap-1 px-1.5 py-px text-[9px] [&_svg]:size-2.5",
	sm: "gap-1 px-2 py-0.5 text-[10px] [&_svg]:size-3",
	md: "gap-1.5 px-2.5 py-1 text-[11px] [&_svg]:size-3.5",
};

const flatSizes: Record<BadgeSize, string> = {
	xs: "gap-1 px-1.5 py-0.5 text-[11px] [&_svg]:size-3",
	sm: "gap-1 px-2 py-0.5 text-xs [&_svg]:size-3.5",
	md: "gap-1.5 px-2.5 py-1 text-[13px] [&_svg]:size-4",
};

export function badgeClassName({
	tone = "neutral",
	size = "sm",
	variant = "outline",
	className,
}: { tone?: BadgeTone; size?: BadgeSize; variant?: BadgeVariant; className?: string } = {}) {
	const flat = variant === "flat";
	return cn(
		"inline-flex shrink-0 items-center whitespace-nowrap [&_svg]:shrink-0",
		flat
			? "rounded-md font-medium leading-tight"
			: "rounded-sm border font-semibold uppercase leading-none tracking-wider",
		(flat ? flatTones : tones)[tone],
		(flat ? flatSizes : sizes)[size],
		className,
	);
}

export function Badge({
	tone,
	size,
	variant,
	className,
	...props
}: ComponentProps<"span"> & { tone?: BadgeTone; size?: BadgeSize; variant?: BadgeVariant }) {
	return <span {...props} className={badgeClassName({ tone, size, variant, className })} />;
}
