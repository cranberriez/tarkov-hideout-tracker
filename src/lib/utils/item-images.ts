/*
 * Item image and tarkov.dev URLs follow fixed patterns for all but ~2% of items, so payloads omit
 * standard URLs and carry only exceptions (placeholders, shared artwork). Always read item image
 * and tarkov.dev links through these helpers rather than the raw fields.
 */
export type ItemImageVariant = "icon" | "grid" | "512" | "base";

const ASSETS = "https://assets.tarkov.dev/";
const IMAGE_FIELDS = {
	icon: ["iconLink", "-icon.webp"],
	grid: ["gridImageLink", "-grid-image.webp"],
	"512": ["image512pxLink", "-512.webp"],
	base: ["baseImageLink", "-base-image.webp"],
} as const;

export interface ItemImageSource {
	id: string;
	iconLink?: string | null;
	gridImageLink?: string | null;
	image512pxLink?: string | null;
	baseImageLink?: string | null;
}

export function standardItemImageUrl(id: string, variant: ItemImageVariant): string {
	return `${ASSETS}${id}${IMAGE_FIELDS[variant][1]}`;
}

export function itemImageUrl(item: ItemImageSource, variant: ItemImageVariant = "icon"): string {
	return item[IMAGE_FIELDS[variant][0]] || standardItemImageUrl(item.id, variant);
}

/** Distinct URLs to try in order, e.g. a large preview falling back to the icon. */
export function itemImageCandidates(item: ItemImageSource, variants: readonly ItemImageVariant[]): string[] {
	return [...new Set(variants.map((variant) => itemImageUrl(item, variant)))];
}

export function itemTarkovDevUrl(item: { normalizedName: string; link?: string | null }): string {
	return item.link || `https://tarkov.dev/item/${item.normalizedName}`;
}

/** Server read boundary: drop image and tarkov.dev links that the helpers above reproduce exactly. */
export function compactItemLinks<T extends ItemImageSource & { normalizedName: string; link?: string | null }>(
	item: T,
): T {
	const compact = { ...item };
	for (const variant of Object.keys(IMAGE_FIELDS) as ItemImageVariant[]) {
		const field = IMAGE_FIELDS[variant][0];
		if (compact[field] === standardItemImageUrl(item.id, variant)) delete compact[field];
	}
	if (compact.link === itemTarkovDevUrl({ normalizedName: item.normalizedName })) delete compact.link;
	return compact;
}
