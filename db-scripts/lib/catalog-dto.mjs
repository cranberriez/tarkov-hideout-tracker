/** Item fields stored only in item_modes columns; projections never carry them. */
const CATALOG_ONLY_ITEM_KEYS = ["itemTypes", "defaultPresetId", "presetContents"];

/** Remove independently refreshed price values and catalog-only item fields while retaining stored DTO shape. */
export function stripCatalogDto(value) {
	if (Array.isArray(value)) return value.map(stripCatalogDto);
	if (!value || typeof value !== "object") return value;
	const entries = Object.entries(value).filter(
		([key]) => !["marketPrice", "buyFromTrader", ...CATALOG_ONLY_ITEM_KEYS].includes(key),
	);
	return Object.fromEntries(
		entries.map(([key, child]) => {
			if (key === "freshness" && child && typeof child === "object" && !Array.isArray(child)) {
				const freshness = Object.fromEntries(
					Object.entries(child).map(([domain, timestamp]) => [
						domain,
						domain.toLowerCase().includes("price") || timestamp === null || timestamp === undefined ? null : 0,
					]),
				);
				return [key, freshness];
			}
			return [key, stripCatalogDto(child)];
		}),
	);
}
