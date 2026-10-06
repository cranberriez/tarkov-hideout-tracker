import type { ItemSummary } from "@/types/items";

/**
 * Catalog entries no longer found in raid that share art and labels with a live item, so a scan
 * would split matches between them. Encrypted flash drive was replaced by Secure Flash drive.
 */
const RETIRED_ITEM_IDS = new Set(["660bbc47c38b837877075e47"]);

/** The catalog the uploader matches against and searches; global search keeps every item. */
export function uploaderCatalog(items: readonly ItemSummary[]): ItemSummary[] {
	return items.filter((item) => !RETIRED_ITEM_IDS.has(item.id));
}
