import type { ReactNode } from "react";
import { ItemReference } from "@/components/entities/item-reference";
import type { PreviewItem } from "@/components/entities/item-link";
import { cn } from "@/lib/utils";

interface ItemDetailItemChipProps {
	item: PreviewItem;
	quantityLabel?: string;
	quantityOverlay?: boolean;
	badges?: ReactNode;
	secondary?: ReactNode;
	className?: string;
	/** Quest-only items are display-only: no item page, pricing, or inventory. */
	linked?: boolean;
	/** Show the short name (full name on hover). */
	preferShortName?: boolean;
	/** No resting background, for chips on an already shaded panel; linked chips still shade on hover. */
	flat?: boolean;
	/** Tint the chip, e.g. to mark the item being viewed within a recipe. */
	highlighted?: boolean;
}

/** Item-detail chip: the shared `ItemReference` chip, linking to the item page. */
export function ItemDetailItemChip({
	linked = true,
	flat = false,
	highlighted = false,
	className,
	...props
}: ItemDetailItemChipProps) {
	return (
		<ItemReference
			variant="chip"
			linked={linked}
			className={cn(flat && "bg-transparent", highlighted && "bg-brand/10 hover:bg-brand/15", className)}
			{...props}
		/>
	);
}
