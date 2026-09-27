import type { ReactNode } from "react";
import { ItemReference } from "@/components/entities/item-reference";
import type { PreviewItem } from "@/components/entities/item-link";

interface ItemDetailItemChipProps {
	item: PreviewItem;
	quantityLabel?: string;
	quantityOverlay?: boolean;
	badges?: ReactNode;
	secondary?: ReactNode;
	className?: string;
	/** Quest-only items are display-only: no item page, pricing, or inventory. */
	linked?: boolean;
}

/** Item-detail chip: the shared `ItemReference` chip, linking to the item page. */
export function ItemDetailItemChip({ linked = true, ...props }: ItemDetailItemChipProps) {
	return <ItemReference variant="chip" linked={linked} {...props} />;
}
