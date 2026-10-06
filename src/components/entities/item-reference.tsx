"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ItemLink, type PreviewItem } from "./item-link";
import { ItemQuantityBadge, ItemThumbnail } from "./item-thumbnail";

/**
 * Item image, name, and quantity. Standard items link to their page with a preview;
 * `linked={false}` renders the same presentation for display-only items (quest pickups).
 * `chip`: compact tile (item details, recipes). `row`: bordered list row (quest rewards/objectives).
 */
export function ItemReference({
	item,
	quantityLabel,
	quantityOverlay = false,
	badges,
	secondary,
	previewDetails,
	linked = true,
	variant = "chip",
	thumbnailSize,
	preferShortName = false,
	className,
}: {
	item: PreviewItem;
	quantityLabel?: string;
	/** Chip only: draw the quantity over the thumbnail. */
	quantityOverlay?: boolean;
	badges?: ReactNode;
	secondary?: ReactNode;
	previewDetails?: ReactNode;
	linked?: boolean;
	variant?: "chip" | "row";
	thumbnailSize?: "sm" | "md";
	/** Chip only: show the short name (full name on hover) for dense layouts such as recipes. */
	preferShortName?: boolean;
	className?: string;
}) {
	const row = variant === "row";
	const chipLabel = (preferShortName && item.shortName) || item.name;
	const content = row ? (
		<>
			<ItemThumbnail item={item} size={thumbnailSize ?? "sm"} className="border-r border-highlight/10 bg-highlight/5" />
			<span className="min-w-0 flex-1 truncate px-2.5 text-xs text-foreground">{item.name}</span>
			{badges}
			{quantityLabel && (
				<span className="shrink-0 pr-2.5 font-mono text-xs font-semibold text-foreground">{quantityLabel}</span>
			)}
		</>
	) : (
		<>
			<ItemThumbnail item={item} size="md">
				{quantityOverlay && quantityLabel && <ItemQuantityBadge label={quantityLabel} />}
			</ItemThumbnail>
			<span className="flex min-w-0 flex-1 flex-col">
				<span className="flex min-w-0 items-center gap-2">
					<span
						className="min-w-0 flex-1 truncate text-foreground/80"
						title={chipLabel === item.name ? undefined : item.name}
					>
						{chipLabel}
					</span>
					{quantityLabel && !quantityOverlay && (
						<span className="shrink-0 font-mono text-xs font-semibold text-foreground">{quantityLabel}</span>
					)}
				</span>
				{secondary && <span className="mt-0.5 flex items-center">{secondary}</span>}
			</span>
			{badges}
		</>
	);
	const classes = cn(
		row
			? "flex min-w-[13rem] max-w-xs flex-[1_1_14rem] items-center border border-highlight/10 bg-shadow/20 text-left"
			: "flex min-h-12 max-w-52 items-center gap-1.5 rounded-[4px] bg-highlight/[0.035] px-1.5 py-1 text-left text-[13px]",
		className,
	);

	if (!linked) return <span className={classes}>{content}</span>;
	return (
		<ItemLink
			item={item}
			previewDetails={previewDetails}
			aria-label={quantityLabel ? `${item.name}, ${quantityLabel}` : undefined}
			className={cn(
				classes,
				"transition-colors focus-visible:outline-2 focus-visible:outline-brand",
				row ? "hover:border-highlight/25 hover:bg-highlight/4" : "hover:bg-highlight/[0.08]",
			)}
		>
			{content}
		</ItemLink>
	);
}
