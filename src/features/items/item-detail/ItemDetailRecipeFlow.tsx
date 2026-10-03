import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import type { PreviewItem } from "@/components/entities/item-link";
import { ItemDetailItemChip } from "./ItemDetailItemChip";

/**
 * Inputs followed by `→ output` on one wrapping line inside a single shaded panel; the arrow
 * and output wrap together. Children should be `flat` chips.
 */
export function ItemDetailRecipeFlow({
	children,
	outputItem,
	outputCount,
	outputIsViewedItem,
	outputSecondary,
}: {
	children: ReactNode;
	outputItem: PreviewItem;
	outputCount: number;
	/** Shown under the output item's name, e.g. a barter's per-reset limit. */
	outputSecondary?: ReactNode;
	/** The viewed item is tinted (like it is among inputs) and not linked to itself. */
	outputIsViewedItem: boolean;
}) {
	return (
		<div className="mt-2.5 flex flex-wrap items-center gap-1 rounded-[4px] bg-highlight/[0.035] p-1">
			{children}
			<span className="flex items-center gap-2">
				<ArrowRight size={16} className="mx-0.5 shrink-0 text-foreground/55" aria-hidden="true" />
				<ItemDetailItemChip
					item={outputItem}
					quantityLabel={`${outputCount}`}
					quantityOverlay
					preferShortName
					flat
					linked={!outputIsViewedItem}
					highlighted={outputIsViewedItem}
					secondary={outputSecondary}
				/>
			</span>
		</div>
	);
}
