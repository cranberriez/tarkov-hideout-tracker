"use client";

import { ItemImage } from "@/components/entities/item-image";
import { ItemLink } from "@/components/entities/item-link";
import type { ItemSummary } from "@/types/items";
import type { ItemAmountRef } from "@/types/recipes";

/** Craft ingredient or product through the shared ItemImage kit; the product also shows its short name. */
export function CraftItem({
	amount,
	item,
	showName = false,
}: {
	amount: ItemAmountRef;
	item: ItemSummary | undefined;
	showName?: boolean;
}) {
	const label = item?.name ?? "Unknown item";
	const shortLabel = item?.shortName || label;
	const quantity = amount.count > 1 ? `×${amount.count}` : undefined;
	const tool = amount.isTool && (
		<span className="absolute -bottom-px -left-px bg-background/90 px-1 py-0.5 font-mono text-[10px] font-semibold leading-none text-info">
			Tool
		</span>
	);
	const image = item ? (
		<ItemImage item={item} size={40} framed quantity={quantity} opensModal>
			{tool}
		</ItemImage>
	) : (
		<ItemImage item={{ name: label }} size={40} framed quantity={quantity}>
			{tool}
		</ItemImage>
	);
	if (!showName) return image;
	return (
		<span className="flex min-w-0 items-center gap-2.5">
			{image}
			{item ? (
				<ItemLink
					item={item}
					title={label}
					className="max-w-40 truncate text-sm font-medium text-foreground transition-colors hover:text-brand"
				>
					{shortLabel}
				</ItemLink>
			) : (
				<span className="max-w-52 truncate text-sm text-muted-foreground">{label}</span>
			)}
		</span>
	);
}
