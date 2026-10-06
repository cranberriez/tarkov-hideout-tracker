"use client";

import { ItemImage } from "@/components/entities/item-image";
import { ItemThumbnail } from "@/components/entities/item-thumbnail";
import type { StoryItemRef } from "@/types/story";

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export function formatStoryCount(count: number | undefined) {
	if (!count || count <= 1) return undefined;
	return count >= 10_000 ? compact.format(count) : String(count);
}

/** Catalog items open the item dialog; story-only items show a placeholder with their name. */
export function StoryItemChip({ item, size = "sm" }: { item: StoryItemRef; size?: "xs" | "sm" | "md" }) {
	const quantity = formatStoryCount(item.count);
	if (item.id) {
		return <ItemImage item={{ id: item.id, name: item.name }} opensModal size={size} framed quantity={quantity} />;
	}
	return (
		<span title={`${item.name} (not in the item catalog)`} className="inline-flex">
			<ItemThumbnail item={{ name: item.name }} size={size} framed quantity={quantity} />
		</span>
	);
}
