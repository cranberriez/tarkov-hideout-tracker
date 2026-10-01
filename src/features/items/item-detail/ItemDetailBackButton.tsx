import Image from "next/image";
import { ArrowLeft, PackageOpen } from "lucide-react";
import type { ItemDetailEntry } from "./item-detail-navigation";

/** Height the Back button takes from the dialog panel (full width on mobile, floating on desktop). */
export const BACK_PANEL_HEIGHT_CLASS = "min-h-[calc(100dvh-3rem)] lg:max-h-[calc(92vh-3rem)]";
export const PANEL_HEIGHT_CLASS = "min-h-dvh lg:max-h-[92vh]";

/** Returns to the previous dialog view: an item, or a recipe breakdown (shown by its output). */
export function ItemDetailBackButton({
	previousEntry,
	onBack,
}: {
	previousEntry: ItemDetailEntry;
	onBack: () => void;
}) {
	const item = previousEntry.kind === "item" ? previousEntry.item : previousEntry.recipe.outputItem;
	return (
		<button
			type="button"
			onClick={onBack}
			className="flex h-12 w-full items-center gap-2 border-b border-border-color bg-background px-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/70 lg:absolute lg:bottom-full lg:left-0 lg:mb-2 lg:h-10 lg:w-auto lg:rounded-md lg:border-0 lg:shadow-2xl"
			aria-label={previousEntry.kind === "item" ? "Back to previous item" : "Back to recipe breakdown"}
		>
			<ArrowLeft size={16} aria-hidden="true" />
			{item.iconLink ? (
				<Image src={item.iconLink} alt="" width={28} height={28} unoptimized className="h-7 w-7 object-contain" />
			) : (
				<PackageOpen className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
			)}
			<span>Back</span>
		</button>
	);
}
